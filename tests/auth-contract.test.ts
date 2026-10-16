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
import {
  signup,
  login,
  requestReset,
  resendConfirmation,
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
  it("rejects unsupported types and PKCE codes without exchanging them", async () => {
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
