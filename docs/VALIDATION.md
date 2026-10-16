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
- GitHub's existing `validate` check for `87c170e` succeeded. This is baseline evidence,
  not a claim about a later deployment or this repair's new remote CI run.
- The supplied staging host and development Supabase project host returned CONNECT
  tunnel 403. No readiness claim is made for the supplied deployment URL.
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
