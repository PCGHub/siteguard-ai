import { appOrigin } from "./auth-origin.ts";
export const stagingProject = {
  vercelId: "prj_y7fZCNyUwEdKfGxE2TaZPaYhwcO5",
  vercelName: "siteguard-ai-dev",
  supabaseRef: "qaguumtcsshopfeyflrp",
} as const;
type Metadata = Record<string, unknown>;
type Check = { name: string; passed: boolean };
/** Pure metadata checks. Never returns tokens, environment values, or template bodies. */
export function inspectStaging(input: {
  deployment: Metadata;
  project: Metadata;
  variables: Metadata[];
  auth: Metadata;
  origin: string;
  expectedCommit: string;
}): Check[] {
  const { deployment, project, variables, auth, expectedCommit } = input;
  const origin = appOrigin(input.origin);
  const meta = (deployment.meta ?? {}) as Metadata;
  const gitSource = (deployment.gitSource ?? {}) as Metadata;
  const actualCommit = meta.githubCommitSha ?? gitSource.sha;
  const aliases = Array.isArray(deployment.alias) ? deployment.alias : [];
  const hosts = [
    deployment.url,
    ...aliases.map((a) => (typeof a === "string" ? a : (a as Metadata)?.alias)),
  ];
  const redirect = `${origin}/auth/confirm`;
  const allowed =
    typeof auth.uri_allow_list === "string"
      ? auth.uri_allow_list.split(",").map((s) => s.trim())
      : [];
  const template = (value: unknown, type: string) =>
    typeof value === "string" &&
    (value.trim() === "" ||
      /{{\s*\.ConfirmationURL\s*}}/.test(value) ||
      (/{{\s*\.RedirectTo\s*}}\?token_hash={{\s*\.TokenHash\s*}}/.test(value) &&
        value.includes(`type=${type}`) &&
        !value.includes(".ConfirmationURL")));
  const hasPreviewVariable = (key: string) =>
    variables.some(
      (v) =>
        v.key === key &&
        Array.isArray(v.target) &&
        v.target.includes("preview") &&
        (!v.gitBranch || v.gitBranch === "dev/foundation"),
    );
  return [
    {
      name: "Exact approved Vercel project",
      passed:
        project.id === stagingProject.vercelId &&
        project.name === stagingProject.vercelName &&
        deployment.projectId === stagingProject.vercelId,
    },
    { name: "Deployment is READY", passed: deployment.readyState === "READY" },
    {
      name: "Deployment is a non-production Preview/Staging",
      passed:
        deployment.target === null ||
        deployment.target === "preview" ||
        deployment.target === "staging",
    },
    {
      name: "Exact requested commit deployed",
      passed:
        /^[a-f0-9]{40}$/.test(expectedCommit) &&
        actualCommit === expectedCommit,
    },
    {
      name: "APP_ORIGIN belongs to this deployment",
      passed: hosts.includes(new URL(origin).host),
    },
    {
      name: "Vercel authentication protection remains configured",
      passed:
        typeof (project.ssoProtection as Metadata | undefined)
          ?.deploymentType === "string",
    },
    ...[
      "APP_ORIGIN",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].map((key) => ({
      name: `Preview variable name present: ${key}`,
      passed: hasPreviewVariable(key),
    })),
    {
      name: "Supabase Site URL matches APP_ORIGIN",
      passed: auth.site_url === origin,
    },
    {
      name: "Supabase explicitly allows the callback",
      passed: allowed.includes(redirect),
    },
    {
      name: "Signup requires email confirmation",
      passed: auth.mailer_autoconfirm === false,
    },
    {
      name: "Signup template supports default PKCE or token hash",
      passed: template(auth.mailer_templates_confirmation_content, "signup"),
    },
    {
      name: "Recovery template supports default PKCE or token hash",
      passed: template(auth.mailer_templates_recovery_content, "recovery"),
    },
  ];
}
