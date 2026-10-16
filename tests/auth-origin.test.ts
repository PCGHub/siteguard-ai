import { describe, it, expect, vi, afterEach } from "vitest";
import { appOrigin, confirmationRedirect } from "../lib/auth-origin";
afterEach(() => vi.unstubAllEnvs());
describe("trusted auth origin", () => {
  it("uses only an explicit origin", () => {
    vi.stubEnv("APP_ORIGIN", "https://staging.example.com");
    expect(confirmationRedirect()).toBe(
      "https://staging.example.com/auth/confirm",
    );
  });
  it("supports explicit localhost development", () => {
    expect(appOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(appOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
  });
  it.each([
    "http://evil.example",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com/?next=evil",
    "https://example.com/#fragment",
    "javascript:alert(1)",
    "//evil.example",
    "",
  ])("rejects unsafe or ambiguous origin %s", (value) =>
    expect(() => appOrigin(value)).toThrow(),
  );
  it("fails closed without configuration", () => {
    vi.stubEnv("APP_ORIGIN", undefined);
    expect(() => confirmationRedirect()).toThrow(/APP_ORIGIN/);
  });
});
