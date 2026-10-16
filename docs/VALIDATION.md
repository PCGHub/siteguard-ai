# Phase 1.5 validation report

## Latest local results

| Check                                                                          | Result                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| ESLint                                                                         | Passed                                         |
| TypeScript                                                                     | Passed                                         |
| Next.js production build                                                       | Passed                                         |
| Unit/database/SDK-contract suite                                               | 46 passed, 0 failed                            |
| Production-build desktop/mobile browser suite                                  | 12 passed, 0 failed, 0 skipped                 |
| Real staging registration → email → confirmation → login → dashboard           | **Not executed: access/configuration blocked** |
| Real staging recovery, reuse/expiry and persisted organization/project journey | **Not executed: same blocker**                 |
| Vercel READY status, environment values, build logs                            | **Not verified: provider access denied**       |
| Live database advisor/security scan                                            | **Not executed: no management credential**     |

The 46 tests comprise 7 existing input-validation tests, 11 trusted-origin tests,
10 integration/contract tests using the real Supabase SDK against a **stub provider**,
and 18 embedded PostgreSQL migration/RLS tests. The stub tests verify real SDK request
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
