import { describe, it, expect } from "vitest";
import { inspectStaging, stagingProject } from "../lib/staging-readiness";
function fixture() {
  return {
    expectedCommit: "a".repeat(40),
    origin: "https://staging.example.test",
    deployment: {
      projectId: String(stagingProject.vercelId),
      readyState: "READY",
      target: null as string | null,
      meta: { githubCommitSha: "a".repeat(40) },
      url: "immutable.example.test",
      alias: ["staging.example.test"],
    },
    project: {
      id: stagingProject.vercelId,
      name: stagingProject.vercelName,
      ssoProtection: { deploymentType: "all" } as object | null,
    },
    variables: [
      "APP_ORIGIN",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].map((key) => ({ key, target: ["preview"], gitBranch: "dev/foundation" })),
    auth: {
      site_url: "https://staging.example.test",
      uri_allow_list:
        "http://127.0.0.1:3000/auth/confirm,https://staging.example.test/auth/confirm",
      mailer_autoconfirm: false,
      mailer_templates_confirmation_content:
        '<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=signup">Confirm</a>',
      mailer_templates_recovery_content:
        '<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Recover</a>',
    },
  };
}
describe("staging metadata gate (fixtures, no live provider verification)", () => {
  it("accepts exact commit, protected preview and matching token-hash configuration", () =>
    expect(inspectStaging(fixture()).every((c) => c.passed)).toBe(true));
  it("rejects READY deployments of older commits", () => {
    const f = fixture();
    f.deployment.meta.githubCommitSha = "b".repeat(40);
    expect(
      inspectStaging(f).find(
        (c) => c.name === "Exact requested commit deployed",
      )?.passed,
    ).toBe(false);
  });
  it("rejects production even when the commit matches", () => {
    const f = fixture();
    f.deployment.target = "production";
    expect(
      inspectStaging(f).find((c) => c.name === "Deployment is a Preview")
        ?.passed,
    ).toBe(false);
  });
  it("rejects builds that are not READY", () => {
    const f = fixture();
    f.deployment.readyState = "BUILDING";
    expect(
      inspectStaging(f).find((c) => c.name === "Deployment is READY")?.passed,
    ).toBe(false);
  });
  it("rejects another project", () => {
    const f = fixture();
    f.deployment.projectId = "another";
    expect(inspectStaging(f)[0].passed).toBe(false);
  });
  it("rejects an origin pointing to an old deployment", () => {
    const f = fixture();
    f.origin = "https://old.example.test";
    expect(
      inspectStaging(f).find(
        (c) => c.name === "APP_ORIGIN belongs to this deployment",
      )?.passed,
    ).toBe(false);
  });
  it("requires protection to remain configured", () => {
    const f = fixture();
    f.project.ssoProtection = null;
    expect(
      inspectStaging(f).find(
        (c) => c.name === "Vercel authentication protection remains configured",
      )?.passed,
    ).toBe(false);
  });
  it("does not count production-only variables as Preview configuration", () => {
    const f = fixture();
    f.variables[0].target = ["production"];
    expect(
      inspectStaging(f).find(
        (c) => c.name === "Preview variable name present: APP_ORIGIN",
      )?.passed,
    ).toBe(false);
  });
  it("rejects localhost Site URL and wildcard-only redirects", () => {
    const f = fixture();
    f.auth.site_url = "http://localhost:3000";
    f.auth.uri_allow_list = "https://*.example.test/**";
    const checks = inspectStaging(f);
    expect(
      checks.find((c) => c.name === "Supabase Site URL matches APP_ORIGIN")
        ?.passed,
    ).toBe(false);
    expect(
      checks.find((c) => c.name === "Supabase explicitly allows the callback")
        ?.passed,
    ).toBe(false);
  });
  it("rejects default PKCE templates and auto-confirmed signup", () => {
    const f = fixture();
    f.auth.mailer_autoconfirm = true;
    f.auth.mailer_templates_confirmation_content = "{{ .ConfirmationURL }}";
    const checks = inspectStaging(f);
    expect(
      checks.find((c) => c.name === "Signup requires email confirmation")
        ?.passed,
    ).toBe(false);
    expect(
      checks.find(
        (c) => c.name === "Signup template uses RedirectTo and token hash",
      )?.passed,
    ).toBe(false);
  });
  it("does not expose supplied provider values in the report", () => {
    const f = fixture();
    f.variables.push({
      key: "PRIVATE_FIXTURE_SECRET",
      target: ["preview"],
      gitBranch: "dev/foundation",
    });
    expect(JSON.stringify(inspectStaging(f))).not.toContain(
      "PRIVATE_FIXTURE_SECRET",
    );
  });
});
