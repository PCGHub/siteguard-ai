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
