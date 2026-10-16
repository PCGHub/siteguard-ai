/** SDK contract integration against a STUB provider. Not a real email/staging test. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fixture = vi.hoisted(() => ({
  configured: true,
  failPath: "",
  used: false,
  cookies: new Map<
    string,
    { name: string; value: string; options: Record<string, unknown> }
  >(),
  requests: [] as {
    path: string;
    redirect: string | null;
    body: Record<string, unknown>;
  }[],
  confirmed: false,
  challenge: "",
}));
vi.mock("@/lib/supabase/server", async () => {
  const { createServerClient } = await import("@supabase/ssr");
  return {
    configured: () => fixture.configured,
    supabase: async () =>
      createServerClient("https://fixture.invalid", "fixture-public-key", {
        cookieOptions: {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
        },
        cookies: {
          getAll: () => [...fixture.cookies.values()],
          setAll: (items) =>
            items.forEach((item) => fixture.cookies.set(item.name, item)),
        },
        global: {
          fetch: async (input, init) => {
            const url = new URL(String(input));
            const body = JSON.parse(String(init?.body ?? "{}"));
            fixture.requests.push({
              path: url.pathname,
              redirect: url.searchParams.get("redirect_to"),
              body,
            });
            if (fixture.failPath === url.pathname)
              return Response.json(
                { code: "validation_failed", msg: "Fixture provider failure" },
                { status: 400 },
              );
            const user = {
              id: "10000000-0000-4000-8000-000000000001",
              aud: "authenticated",
              role: "authenticated",
              email: "fixture@example.test",
              email_confirmed_at: fixture.confirmed
                ? "2026-01-01T00:00:00Z"
                : undefined,
              created_at: "2026-01-01T00:00:00Z",
              app_metadata: {},
              user_metadata: {},
            };
            if (
              [
                "/auth/v1/signup",
                "/auth/v1/resend",
                "/auth/v1/recover",
              ].includes(url.pathname)
            )
              fixture.challenge = body.code_challenge ?? "";
            if (url.searchParams.get("grant_type") === "pkce") {
              const { createHash } = await import("node:crypto");
              const challenge = createHash("sha256")
                .update(body.code_verifier ?? "")
                .digest("base64url");
              if (
                body.auth_code !== "fixture-pkce-code" ||
                !fixture.challenge ||
                challenge !== fixture.challenge ||
                fixture.used
              )
                return Response.json(
                  { code: "flow_state_not_found", msg: "Invalid flow" },
                  { status: 400 },
                );
              fixture.used = true;
              fixture.confirmed = true;
            }
            if (url.pathname.endsWith("/user")) return Response.json(user);
            if (url.pathname.endsWith("/logout"))
              return new Response(null, { status: 204 });
            if (url.pathname.endsWith("/signup"))
              return Response.json({ user, session: null });
            if (
              url.pathname.endsWith("/recover") ||
              url.pathname.endsWith("/resend")
            )
              return Response.json({});
            if (url.pathname.endsWith("/verify")) {
              if (body.token_hash !== "fixture-token-hash" || fixture.used)
                return Response.json(
                  { code: "otp_expired", msg: "Expired" },
                  { status: 403 },
                );
              fixture.used = true;
              fixture.confirmed = true;
            }
            if (url.pathname.endsWith("/token") && !fixture.confirmed)
              return Response.json(
                { code: "email_not_confirmed", msg: "Email not confirmed" },
                { status: 400 },
              );
            const payload = Buffer.from(
              JSON.stringify({
                sub: user.id,
                exp: Math.floor(Date.now() / 1000) + 3600,
              }),
            ).toString("base64url");
            const header = Buffer.from(
              JSON.stringify({ alg: "HS256", typ: "JWT" }),
            ).toString("base64url");
            return Response.json({
              access_token: `${header}.${payload}.fixture-signature`,
              refresh_token: "fixture-refresh-token",
              expires_in: 3600,
              token_type: "bearer",
              user: { ...user, email_confirmed_at: "2026-01-01T00:00:00Z" },
            });
          },
        },
      }),
  };
});
import { GET } from "../app/auth/confirm/route";
import { GET as callback } from "../app/auth/callback/route";
import {
  signup,
  login,
  requestReset,
  resendConfirmation,
  resetPassword,
  logout,
} from "../app/actions";
function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([k, v]) => result.set(k, v));
  return result;
}
beforeEach(() => {
  fixture.cookies.clear();
  fixture.requests = [];
  fixture.used = false;
  fixture.confirmed = false;
  fixture.configured = true;
  fixture.failPath = "";
  fixture.challenge = "";
  vi.stubEnv("APP_ORIGIN", "https://staging.example.com");
});
afterEach(() => vi.unstubAllEnvs());
describe("auth SDK and callback contract (stub provider)", () => {
  it("signup explicitly sends the trusted redirect to the provider", async () => {
    await expect(
      signup(
        form({
          email: "fixture@example.test",
          password: "fixture-password-only",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(fixture.requests[0]).toMatchObject({
      path: "/auth/v1/signup",
      body: { email: "fixture@example.test" },
    });
    expect(fixture.requests[0].redirect).toBe(
      "https://staging.example.com/auth/confirm",
    );
  });
  it.each(["signup", "resend", "recovery"])(
    "default email %s uses PKCE and establishes a secure session",
    async (flow) => {
      const action =
        flow === "signup"
          ? signup
          : flow === "resend"
            ? resendConfirmation
            : requestReset;
      await expect(
        action(
          form({
            email: "fixture@example.test",
            password: "fixture-password-only",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(fixture.requests[0].body.code_challenge_method).toBe("s256");
      expect(fixture.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(
        [...fixture.cookies.values()].some(
          (c) => c.name.includes("code-verifier") && c.options.httpOnly,
        ),
      ).toBe(true);
      const response = await GET(
        new NextRequest(
          "https://staging.example.com/auth/confirm?code=fixture-pkce-code&type=" +
            (flow === "recovery" ? "signup" : "recovery") +
            "&next=https://evil.example",
        ),
      );
      expect(response.headers.get("location")).toBe(
        flow === "recovery"
          ? "/reset-password"
          : "/login?message=Email+confirmed.+Sign+in+to+continue.",
      );
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      const sessionCookies = [...fixture.cookies.values()].filter(
        (c) => c.value && !c.name.includes("code-verifier"),
      );
      expect(sessionCookies.length).toBeGreaterThan(0);
      expect(
        sessionCookies.every(
          (c) =>
            c.options.httpOnly &&
            c.options.secure &&
            c.options.sameSite === "lax",
        ),
      ).toBe(true);
      expect(
        fixture.requests.find((r) => r.body.auth_code === "fixture-pkce-code")
          ?.body.code_verifier,
      ).toBeTruthy();
      if (flow === "recovery") {
        await expect(
          resetPassword(form({ password: "fixture-new-password-only" })),
        ).rejects.toThrow("NEXT_REDIRECT");
      } else {
        await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
        await expect(
          login(
            form({
              email: "fixture@example.test",
              password: "fixture-password-only",
            }),
          ),
        ).rejects.toThrow("NEXT_REDIRECT");
      }
    },
  );
  it("uses the exact SDK flow slot when an explicit flow ID is supplied", async () => {
    await expect(
      requestReset(form({ email: "fixture@example.test" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    const flowId = [...fixture.cookies.keys()]
      .map((k) => k.match(/-flow-([a-f0-9]{32})-code-verifier/)?.[1])
      .find(Boolean);
    expect(flowId).toBeTruthy();
    const response = await GET(
      new NextRequest(
        `https://staging.example.com/auth/confirm?code=fixture-pkce-code&sb_flow_id=${flowId}`,
      ),
    );
    expect(response.headers.get("location")).toBe("/reset-password");
  });
  it("does not borrow the legacy verifier for an unknown explicit flow slot", async () => {
    await expect(
      requestReset(form({ email: "fixture@example.test" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    fixture.requests = [];
    const response = await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?code=fixture-pkce-code&sb_flow_id=" +
          "f".repeat(32),
      ),
    );
    expect(response.headers.get("location")).toContain("invalid+or+expired");
    expect(fixture.requests).toHaveLength(0);
  });
  it("default email code fails closed in another browser without the verifier", async () => {
    await expect(
      requestReset(form({ email: "fixture@example.test" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    fixture.cookies.clear();
    fixture.requests = [];
    const response = await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?code=fixture-pkce-code",
      ),
    );
    expect(response.headers.get("location")).toContain("same+browser");
    expect(fixture.requests).toHaveLength(0);
    expect([...fixture.cookies.values()].filter((c) => c.value)).toHaveLength(
      0,
    );
  });
  it.each(["expired", "reused", "mismatched"])(
    "rejects a %s PKCE code without creating a new session",
    async (reason) => {
      await expect(
        requestReset(form({ email: "fixture@example.test" })),
      ).rejects.toThrow("NEXT_REDIRECT");
      if (reason === "expired") fixture.failPath = "/auth/v1/token";
      if (reason === "reused") fixture.used = true;
      if (reason === "mismatched")
        fixture.challenge = "not-the-requested-challenge";
      const response = await callback(
        new NextRequest(
          "https://staging.example.com/auth/callback?code=fixture-pkce-code&next=//evil.example",
        ),
      );
      expect(response.headers.get("location")).toContain("invalid+or+expired");
      expect(
        [...fixture.cookies.values()].filter(
          (c) => c.value && !c.name.includes("code-verifier"),
        ),
      ).toHaveLength(0);
    },
  );
  it("compatibility callback exchanges a valid code with a fixed local destination", async () => {
    await expect(
      requestReset(form({ email: "fixture@example.test" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    const response = await callback(
      new NextRequest(
        "https://staging.example.com/auth/callback?code=fixture-pkce-code&next=https://evil.example",
      ),
    );
    expect(response.headers.get("location")).toBe("/reset-password");
  });
  it.each([
    "code=one&code=two",
    "code=fixture-pkce-code&token_hash=fixture-token-hash&type=signup",
    "code=fixture-pkce-code&error=access_denied",
    "code=fixture-pkce-code&error_code=expired",
    "code=fixture-pkce-code&sb_flow_id=invalid",
    "code=%20invalid",
    "code=" + "a".repeat(2049),
    "token_hash=fixture-token-hash&type=signup&type=recovery",
  ])(
    "rejects ambiguous or malformed callback input without provider calls (%#)",
    async (query) => {
      const response = await GET(
        new NextRequest("https://staging.example.com/auth/confirm?" + query),
      );
      expect(response.headers.get("location")).toContain("invalid+or+expired");
      expect(fixture.requests).toHaveLength(0);
    },
  );
  it("verification uses token hash, writes secure session cookies, and leads to sign-in", async () => {
    const response = await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?token_hash=fixture-token-hash&type=signup&next=https://evil.example",
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toMatch(/^\/login\?message=Email/);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fixture.requests[0]).toMatchObject({
      path: "/auth/v1/verify",
      body: { type: "signup", token_hash: "fixture-token-hash" },
    });
    expect(fixture.cookies.size).toBeGreaterThan(0);
    expect(
      [...fixture.cookies.values()].every(
        (c) =>
          c.options.httpOnly &&
          c.options.secure &&
          c.options.sameSite === "lax",
      ),
    ).toBe(true);
  });
  it("a reused confirmation is rejected without leaking its value", async () => {
    const url =
      "https://staging.example.com/auth/confirm?token_hash=fixture-token-hash&type=signup";
    await GET(new NextRequest(url));
    fixture.cookies.clear();
    const response = await GET(new NextRequest(url));
    expect(response.headers.get("location")).toContain("invalid+or+expired");
    expect(response.headers.get("location")).not.toContain(
      "fixture-token-hash",
    );
  });
  it("recovery establishes a session and redirects only to password reset", async () => {
    const response = await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?token_hash=fixture-token-hash&type=recovery&next=//evil.example",
      ),
    );
    expect(response.headers.get("location")).toBe("/reset-password");
    expect(fixture.cookies.size).toBeGreaterThan(0);
  });
  it("rejects unsupported token types and codes without a verifier", async () => {
    for (const query of [
      "code=fixture-code",
      "token_hash=fixture-token-hash&type=invite",
      "token_hash=fixture-token-hash&type=email",
    ]) {
      const response = await GET(
        new NextRequest(`https://staging.example.com/auth/confirm?${query}`),
      );
      expect(response.headers.get("location")).toContain("invalid+or+expired");
    }
    expect(fixture.requests).toHaveLength(0);
  });
  it("fails closed when configuration is absent", async () => {
    fixture.configured = false;
    const response = await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?token_hash=fixture-token-hash&type=signup",
      ),
    );
    expect(response.status).toBe(303);
    expect(fixture.requests).toHaveLength(0);
  });
  it("rejects login before confirmation, then accepts a password login after verification", async () => {
    await expect(
      login(
        form({
          email: "fixture@example.test",
          password: "fixture-password-only",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(fixture.cookies.size).toBe(0);
    await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?token_hash=fixture-token-hash&type=signup",
      ),
    );
    fixture.cookies.clear();
    await expect(
      login(
        form({
          email: "fixture@example.test",
          password: "fixture-password-only",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(fixture.cookies.size).toBeGreaterThan(0);
    expect(fixture.requests.some((r) => r.path === "/auth/v1/token")).toBe(
      true,
    );
  });
  it.each(["/auth/v1/recover", "/auth/v1/resend"])(
    "reports provider failure instead of claiming an email was sent: %s",
    async (path) => {
      fixture.failPath = path;
      try {
        await (path.endsWith("recover") ? requestReset : resendConfirmation)(
          form({ email: "fixture@example.test" }),
        );
        throw new Error("Expected a redirect");
      } catch (error) {
        expect((error as { digest?: string }).digest).toContain(
          "message=Unable",
        );
      }
    },
  );
  it("reports failed sign-out after a successful password reset without claiming logout", async () => {
    await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?token_hash=fixture-token-hash&type=recovery",
      ),
    );
    fixture.failPath = "/auth/v1/logout";
    try {
      await resetPassword(form({ password: "fixture-new-password-only" }));
      throw new Error("Expected redirect");
    } catch (error) {
      const digest = (error as { digest?: string }).digest;
      expect(digest).toContain("/reset-password?");
      expect(digest).toContain("sign-out%20failed");
    }
    expect(
      fixture.requests.some(
        (r) =>
          r.path === "/auth/v1/user" &&
          r.body.password === "fixture-new-password-only",
      ),
    ).toBe(true);
  });
  it("requires a verified session before updating a password", async () => {
    await expect(
      resetPassword(form({ password: "fixture-new-password-only" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(fixture.requests).toHaveLength(0);
  });
  it("successful recovery logs out before offering sign-in", async () => {
    await GET(
      new NextRequest(
        "https://staging.example.com/auth/confirm?token_hash=fixture-token-hash&type=recovery",
      ),
    );
    try {
      await resetPassword(form({ password: "fixture-new-password-only" }));
      throw new Error("Expected redirect");
    } catch (error) {
      expect((error as { digest?: string }).digest).toContain(
        "/login?message=Password%20updated",
      );
    }
    expect(fixture.requests.some((r) => r.path === "/auth/v1/logout")).toBe(
      true,
    );
    expect([...fixture.cookies.values()].filter((c) => c.value)).toHaveLength(
      0,
    );
  });
  it("rejects oversized authentication inputs before contacting the provider", async () => {
    for (const [action, values] of [
      [login, { email: "fixture@example.test", password: "x".repeat(129) }],
      [requestReset, { email: "a".repeat(260) + "@example.test" }],
    ] as const) {
      await expect(action(form(values))).rejects.toThrow("NEXT_REDIRECT");
    }
    expect(fixture.requests).toHaveLength(0);
  });
  it("recovery and resend use the same trusted callback", async () => {
    await expect(
      requestReset(form({ email: "fixture@example.test" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(
      resendConfirmation(form({ email: "fixture@example.test" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(fixture.requests.map((r) => r.path)).toEqual([
      "/auth/v1/recover",
      "/auth/v1/resend",
    ]);
    for (const req of fixture.requests)
      expect(req.redirect).toBe("https://staging.example.com/auth/confirm");
  });
});
