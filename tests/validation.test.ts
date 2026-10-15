import { describe, it, expect } from "vitest";
import {
  credentials,
  organizationInput,
  projectInput,
  safeNext,
} from "../lib/validation";
describe("untrusted input", () => {
  it("rejects weak passwords and malformed emails", () => {
    expect(
      credentials.safeParse({ email: "bad", password: "short" }).success,
    ).toBe(false);
  });
  it("accepts a valid account", () => {
    expect(
      credentials.safeParse({
        email: "safety@example.com",
        password: "a-long-test-password",
      }).success,
    ).toBe(true);
  });
  it("rejects blank company names", () => {
    expect(organizationInput.safeParse({ name: "  " }).success).toBe(false);
  });
  it("trims company names", () => {
    expect(organizationInput.parse({ name: "  SiteGuard  " }).name).toBe(
      "SiteGuard",
    );
  });
  it("rejects forged organization IDs and industries", () => {
    expect(
      projectInput.safeParse({
        organization_id: "other",
        name: "Site",
        location: "",
        industry: "unknown",
      }).success,
    ).toBe(false);
  });
  it("accepts a valid project", () => {
    expect(
      projectInput.safeParse({
        organization_id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Plant",
        location: "Lagos",
        industry: "Construction",
      }).success,
    ).toBe(true);
  });
  it("blocks external and protocol-relative redirects", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/dashboard?next=evil",
      null,
    ])
      expect(safeNext(value)).toBe("/dashboard");
    expect(safeNext("/reset-password")).toBe("/reset-password");
  });
});
