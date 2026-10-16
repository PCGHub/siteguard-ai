import { test, expect } from "@playwright/test";
test("public entry and responsive layout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /See the hazard/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create your workspace" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Create your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Create account" }),
  ).toBeVisible();
});
test("unconfigured auth is explicit and dashboard fails closed", async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    "Only applies to unconfigured startup",
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("p[role=alert]")).toContainText(
    "Supabase configuration is required",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
});
test("invalid email confirmations fail safely", async ({ page }) => {
  await page.goto("/auth/confirm?next=https://example.com");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("status")).toContainText("invalid or expired");
});
test("retired root authorization codes are removed and explained", async ({
  page,
}) => {
  await page.goto("/?code=fixture-retired-code");
  await expect(page).toHaveURL(/\/login\?message=/);
  await expect(page.getByRole("status")).toContainText("unsupported format");
  expect(page.url()).not.toContain("fixture-retired-code");
});
test("retired callback cannot redirect to an attacker", async ({ page }) => {
  await page.goto(
    "/auth/callback?code=fixture-retired-code&next=https://evil.example",
  );
  await expect(page).toHaveURL(/\/login\?message=/);
  await expect(page.getByRole("status")).toContainText(
    "Request a new confirmation",
  );
  expect(page.url()).not.toContain("fixture-retired-code");
});
test("confirmation resend has a clear responsive entry point", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("link", { name: "Resend confirmation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resend confirmation email" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
