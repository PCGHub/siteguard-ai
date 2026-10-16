import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
// Runs only against the local Supabase stack and its local Mailpit inbox.
// Uses synthetic test accounts, never production credentials or customer records.
test("signup, verified session, onboarding, project persistence, logout and password recovery", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const envFile = readFileSync(".env.local", "utf8");
  expect(envFile).toMatch(
    /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321\s*$/m,
  );
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321").toBe(
    "http://127.0.0.1:54321",
  );
  const email = `siteguard-${Date.now()}-${testInfo.project.name}@example.test`;
  const password = "Local-test-only-password-42!";
  async function emailLink(subject: string) {
    let link = "";
    await expect
      .poll(
        async () => {
          const response = await request.get(
            "http://127.0.0.1:54324/api/v1/messages",
          );
          const data = await response.json();
          const message = data.messages?.find(
            (m: { Subject: string; To: { Address: string }[] }) =>
              m.Subject.includes(subject) &&
              m.To.some((t) => t.Address === email),
          );
          if (!message) return false;
          const detail = await (
            await request.get(
              `http://127.0.0.1:54324/api/v1/message/${message.ID}`,
            )
          ).json();
          link =
            detail.HTML?.match(/href="([^"]+)"/)?.[1]?.replaceAll(
              "&amp;",
              "&",
            ) ?? "";
          return Boolean(link);
        },
        { timeout: 30000 },
      )
      .toBe(true);
    // Do not print token-bearing email URLs.
    return link;
  }
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("verify your email");
  await page.goto(await emailLink("Confirm"));
  await expect(page.getByRole("status")).toContainText("Email confirmed");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create your company workspace" }),
  ).toBeVisible();
  const sessionCookies = (await page.context().cookies()).filter((c) =>
    c.name.includes("auth-token"),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);
  expect(
    sessionCookies.every((c) => c.httpOnly && c.secure && c.sameSite === "Lax"),
  ).toBe(true);
  await page
    .getByLabel("Company name")
    .fill(`Test Company ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: `Test Company ${testInfo.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Project name").fill("Test refinery expansion");
  await page.getByLabel("Site / location").fill("Synthetic test site");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.getByRole("heading", { name: "Test refinery expansion" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Test refinery expansion" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Guarded local Mailpit journey only; this is not a hosted acceptance claim.
  await page.goto("/inspections");
  await page
    .getByRole("link", { name: "Create inspection", exact: true })
    .click();
  await page
    .getByLabel("Inspection title", { exact: true })
    .fill("Local platform inspection");
  await page
    .getByLabel("Work area / location", { exact: true })
    .fill("North platform");
  await page
    .getByLabel("Inspection date and time (UTC)", { exact: true })
    .fill("2026-10-16T12:30");
  await page
    .getByLabel("Inspector name", { exact: true })
    .fill("Synthetic local inspector");
  await page
    .getByLabel("Observations", { exact: true })
    .fill("Synthetic observations requiring review.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Local platform inspection",
      exact: true,
    }),
  ).toBeVisible();
  const inspectionPath = new URL(page.url()).pathname;
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Local platform inspection",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit draft", exact: true }).click();
  await page
    .getByLabel("Inspection title", { exact: true })
    .fill("Updated platform inspection");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Status updated");
  await expect(
    page.getByRole("link", { name: "Edit draft", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Begin review", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Back to company inspections", exact: true })
    .click();
  await page
    .getByLabel("Search title", { exact: true })
    .fill("Updated platform");
  await page.getByLabel("Status", { exact: true }).selectOption("submitted");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(
    page.getByRole("link", {
      name: "Updated platform inspection",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto(inspectionPath);
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test refinery expansion" }),
  ).toBeVisible();
  await page.goto(inspectionPath);
  await expect(
    page.getByRole("heading", {
      name: "Updated platform inspection",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send recovery email" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If this account exists",
  );
  await page.goto(await emailLink("Reset"));
  await page.getByLabel("Password", { exact: true }).fill(password + "new");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password + "new");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test refinery expansion" }),
  ).toBeVisible();
});
