import { execFileSync, spawnSync } from "node:child_process";
import { inspectStaging, stagingProject } from "../lib/staging-readiness.ts";
const required = ["VERCEL_TOKEN", "SUPABASE_ACCESS_TOKEN", "APP_ORIGIN"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing secure environment settings: ${missing.join(", ")}`);
  process.exitCode = 2;
} else {
  try {
    const expectedCommit =
      process.env.EXPECTED_STAGING_COMMIT ??
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (!/^[a-f0-9]{40}$/.test(expectedCommit))
      throw new Error("EXPECTED_STAGING_COMMIT must be a full commit SHA.");
    if (
      spawnSync(
        "git",
        ["merge-base", "--is-ancestor", "5d45bbf", expectedCommit],
        { stdio: "ignore" },
      ).status !== 0
    )
      throw new Error(
        "Requested commit must include 5d45bbf or a later descendant.",
      );
    const team = process.env.VERCEL_TEAM_ID;
    // Only these exact provider hosts and the approved development project are queried.
    async function read(url, token) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw new Error(
          `Read-only provider check failed with HTTP ${response.status}.`,
        );
      return response.json();
    }
    function vercelUrl(path, query = {}) {
      const url = new URL(path, "https://api.vercel.com");
      if (team) url.searchParams.set("teamId", team);
      Object.entries(query).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      return url;
    }
    const [project, list, envs, auth] = await Promise.all([
      read(
        vercelUrl(`/v9/projects/${stagingProject.vercelId}`),
        process.env.VERCEL_TOKEN,
      ),
      read(
        vercelUrl("/v6/deployments", {
          projectId: stagingProject.vercelId,
          limit: "100",
        }),
        process.env.VERCEL_TOKEN,
      ),
      read(
        vercelUrl(`/v9/projects/${stagingProject.vercelId}/env`),
        process.env.VERCEL_TOKEN,
      ),
      read(
        `https://api.supabase.com/v1/projects/${stagingProject.supabaseRef}/config/auth`,
        process.env.SUPABASE_ACCESS_TOKEN,
      ),
    ]);
    const candidates =
      list.deployments?.filter(
        (d) =>
          d.target !== "production" &&
          (d.meta?.githubCommitSha === expectedCommit ||
            d.gitSource?.sha === expectedCommit),
      ) ?? [];
    const match =
      candidates.find((d) => d.readyState === "READY" || d.state === "READY") ??
      candidates[0];
    if (!match)
      throw new Error(
        "No non-production deployment of the exact requested commit was found among the latest 100 deployments.",
      );
    const deployment = await read(
      vercelUrl(`/v13/deployments/${encodeURIComponent(match.uid)}`),
      process.env.VERCEL_TOKEN,
    );
    const checks = inspectStaging({
      deployment,
      project,
      variables: envs.envs ?? [],
      auth,
      origin: process.env.APP_ORIGIN,
      expectedCommit,
    });
    checks.forEach((check) =>
      console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`),
    );
    console.log(`Expected deployment commit: ${expectedCommit}`);
    console.log(
      "Environment values were not inspected or printed. This does not prove real email delivery or login acceptance.",
    );
    if (checks.some((check) => !check.passed)) process.exitCode = 1;
  } catch (error) {
    // Never print provider payloads, token values, or raw fetch errors.
    const safe =
      error instanceof Error &&
      /^(EXPECTED_STAGING_COMMIT|Requested commit|Read-only provider check|No non-production deployment)/.test(
        error.message,
      )
        ? error.message
        : "Preflight could not complete; check secure settings, APP_ORIGIN and provider connectivity.";
    console.error(safe);
    process.exitCode = 1;
  }
}
