> Current default-email repair validation is recorded below under “Default-email repair”.
> Earlier entries describe historical code and do not establish live staging acceptance.

# Phase 1.5 validation report

## Latest local results

| Check                                                                          | Result                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| ESLint                                                                         | Passed                                         |
| TypeScript                                                                     | Passed                                         |
| Next.js production build                                                       | Passed                                         |
| Unit/database/SDK-contract suite                                               | 57 passed, 0 failed                            |
| Production-build desktop/mobile browser suite                                  | 12 passed, 0 failed, 0 skipped                 |
| Real staging registration → email → confirmation → login → dashboard           | **Not executed: access/configuration blocked** |
| Real staging recovery, reuse/expiry and persisted organization/project journey | **Not executed: same blocker**                 |
| Vercel READY status, environment values, build logs                            | **Not verified: provider access denied**       |
| Live database advisor/security scan                                            | **Not executed: no management credential**     |

The 57 tests comprise 7 existing input-validation tests, 11 trusted-origin tests,
10 integration/contract tests using the real Supabase SDK against a **stub provider**,
18 embedded PostgreSQL migration/RLS tests, and 11 staging-readiness metadata fixture tests. The stub tests verify real SDK request
serialization, token-hash callback handling, secure-cookie writes, replay/error paths,
login sequencing and trusted redirects. They do **not** prove real provider behavior,
SMTP delivery, hosted session persistence or staging readiness.

PostgreSQL tests now execute **both** existing migrations in order, including
`202610160001_restrict_privileged_function_execute.sql`. The security migration and
all original database definitions were preserved. Tests verify tenant read/write/delete
isolation, role-escalation denial, private storage policy, transactional onboarding,
immutable audit events, anonymous denial and the intended authenticated definer grants.
PGlite uses minimal auth/storage fixtures, not Supabase HTTP services.

The 12 Chromium browser tests ran on desktop and mobile against the current local
production build without real Supabase bindings. They verify public navigation,
configuration guidance, protected dashboard denial, invalid confirmations, retired
root/callback code stripping and responsive confirmation-resend entry.

Initial contract tests expected redirect metadata in the JSON body; the installed SDK
correctly sends it as `redirect_to` in the query string. Assertions were corrected to
inspect the actual SDK request. Initial browser tests found that Next.js Proxy requires
absolute redirect locations. Retired-link handling was moved to the landing Server
Component and callback Route Handler, keeping fixed relative destinations and no
trust in request Host headers. All affected tests passed on rerun.

## External evidence and remaining blockers

- Fetched and fast-forwarded `dev/foundation` to user-provided commit `87c170e` before
  editing. Draft PR #1 is open against main. GitHub API and Git reads now work.
- GitHub Actions `validate` completed successfully for repair commit `e7c7b2a`. This proves repository CI, not a Vercel deployment or real email acceptance.
- After the owner authorized the network additions, staging became reachable but returned HTTP 302 to Vercel SSO protection. The development Supabase Auth health endpoint returned HTTP 401 without a public key. These responses establish connectivity, not deployment READY status or application readiness.
- Supabase management API returned HTTP 401 without credentials. Vercel API returned
  HTTP 403. No usable Supabase/Vercel bindings or application public key are injected.
- No live Auth Site URL, email template, Vercel variable or provider setting was read
  or changed. The localhost/default-PKCE mismatch is diagnosed from the reported URL
  and repository behavior; the live dashboard fields still need inspection.
- No Docker stack retry was performed: the earlier confirmed vfs/32 GB disk limitation
  remains documented. Two guarded local full-journey browser cases remain unrun.

Saved **draft** requirements: APP_ORIGIN, the exact development Supabase URL, the two
approved staging/project host additions, and secure SUPABASE_ACCESS_TOKEN / VERCEL_TOKEN
bindings for management inspection. Supabase publishable-key entry remains required.
No credential values were saved in source or chat. Saving the draft does not apply it,
configure either provider, or publish an environment. Review/save changes in environment
settings; publish only when the desired environment capabilities are acceptable.

## Before Phase 2

Follow [AUTH_STAGING.md](AUTH_STAGING.md): identify a READY deployment/stable alias of
the repaired development commit, set APP_ORIGIN and the development public variables,
update the development project's Site URL/redirect allowlist and both token-hash email
templates, then request a fresh confirmation email and run the real full journey.

No production credentials, production deployment, merge to main, or unrelated Supabase
project changes are authorized or performed. **Phase 2 remains blocked until real
registration, email confirmation, login and dashboard acceptance is verified.**

## Access follow-up

The owner's existing development infrastructure is the only authorized target. No
new project is needed. A publishable key already set in Vercel does not inject that
value into this cloud runner. The following secure environment entries are still
absent here:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public key of the existing development project.
- `SUPABASE_ACCESS_TOKEN`: authorized management access to inspect/update only the named development project.
- `VERCEL_TOKEN`: authorized project/team access to inspect READY state, deployed commit, variable metadata and build logs.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: supported machine access for this protected staging deployment, if automated browser acceptance is to run here. Do not disable deployment protection.
- `APP_ORIGIN`: the verified READY stable staging origin; do not select the older immutable candidate before its commit is checked.

These requirements are saved as a draft for secure entry/review. No credential
values were requested in chat or inferred from the other providers. Supabase and
Vercel management requests still return 401 and 403 respectively; exact Site URL,
email templates, READY state and real user journey remain unverified.

## Latest deployment preparation

The owner confirms that the existing READY staging deployment is still commit
87c170e, not the repair. This is owner-supplied evidence; the runner still cannot
inspect Vercel deployment metadata. The new read-only `npm run staging:check` exits
2 with the exact missing setting names (`VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`,
`APP_ORIGIN`) and makes no provider calls when those settings are absent. Its 11
fixture tests cover older commits, non-READY/Production targets, wrong projects and
aliases, disabled protection, missing Preview variables and incorrect Auth templates.
The full suite now has 57 passing tests; lint, typecheck and build passed. This is
not evidence of a newly READY deployment or real staging authentication.

## Connected-service recheck and minimum-access option

GitHub CI for cc83340 completed successfully. Accessible GitHub deployment records
and commit deployment statuses are empty, there are no Vercel PR bot comments, and
the sole accessible workflow is Validate (no deployment job). Webhook and repository
secret metadata return integration permission errors. No Vercel/Supabase connector
is exposed. Management API rechecks still return Vercel 403 / Supabase 401; the known
app host redirects to Vercel SSO. No repaired READY deployment has been verified.

Management tokens are optional: the owner can use the existing provider dashboards
following [STAGING_OPERATOR_HANDOFF.md](STAGING_OPERATOR_HANDOFF.md). Agent-operated
management needs narrowly authorized provider access; protected hosted browser testing
needs authorized staging machine access, not a copy of Vercel's public key. No new
tests or code changes were necessary for this documentation-only capability audit.

## Default-email repair

The development-email repair adds PKCE exchange for Supabase's built-in
ConfirmationURL links while preserving token-hash verification. It uses server-only
HttpOnly session/verifier cookies, fixed local redirects and the SDK recovery marker;
it does not accept implicit fragment sessions. The local Supabase config now uses
default templates. Current operating instructions supersede historical template-only
guidance above: [AUTH_STAGING.md](AUTH_STAGING.md).

Final checks for this repair:

- ESLint and TypeScript pass.
- Vitest: 84 tests pass in five files. SDK contracts use a stub provider checking
  actual challenge/verifier pairing, not real Supabase emails. Explicit flow-slot,
  missing/mismatched verifier, expiry/replay, recovery routing, secure cookies,
  token-hash compatibility and redirect rejection are covered.
- Production build passes.
- Desktop/mobile local production browser suite: 14 tests pass, none skipped, with
  no live Supabase configuration. This does not test hosted email or a real session.
- `git diff --check` passes.
- Read-only staging preflight exits 2 for missing `VERCEL_TOKEN` and
  `SUPABASE_ACCESS_TOKEN` (APP_ORIGIN supplied as non-secret staging origin).
- Full local Supabase/Mailpit journey was not run; this runner's previously
  diagnosed Docker disk limitation remains. No migrations or dependencies changed.

No provider settings, infrastructure or production deployment were changed. Real
staging registration, email receipt/confirmation, login, organization/project journey,
logout and recovery remain unrun. Supabase default delivery requires an existing
authorized team address and is currently limited to two emails/hour, best-effort.
Use the same browser/profile and stable origin for request and confirmation; deploy
this repair to protected staging first. No custom SMTP/domain purchase or management
token is needed for owner-assisted browser acceptance. Record the live results before
Phase 1.5 signoff; historical audit dependency/abuse-control findings remain open.


## Final owner acceptance and permission review

Owner-reported live browser successes are recorded individually in
[PHASE_1_5_SIGN_OFF.md](PHASE_1_5_SIGN_OFF.md). They supersede earlier statements that
the demonstrated browser journey remains unrun; Codex has not independently repeated
those live tests. Direct hosted API/Storage negative tests remain unexecuted.

Latest local checks: lint/typecheck pass; 93 tests pass, including 27 embedded
PostgreSQL tests. New cases cover all non-admin roles, full tenant-table grants/RLS,
membership revocation, two companies under one identity, wrong buckets/prefixes and
own-company upload denial. Initial transaction-cleanup assertion failures in five
new cases were corrected in the test harness; no application/policy fix was needed.
Runtime dependency audit reports zero advisories; full audit still reports five High
entries from the existing development-tool chain. No new build/browser result is
claimed for this tests/documentation-only review.
