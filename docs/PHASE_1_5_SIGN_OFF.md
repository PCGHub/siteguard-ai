# Phase 1.5 acceptance and security review

Review date: 2026-10-16 (America/Los_Angeles). Branch: `dev/foundation`.
Reviewed application baseline: `ac3a07777b9de6d18378ebe422ce35ded9cb7d7d`.
This review adds security tests and documentation, not application or policy changes.

## Decision and scope

**Record Phase 1.5 functional acceptance as owner-reported PASS. Recommend proceeding
with Phase 2 development on the protected development environment. This is not
production release approval or a completed live API security certification.**

No release-blocking runtime vulnerability was identified in the reviewed application
and migrations. The remaining High development-tool advisory and unverified deployed
policy/API enforcement remain explicit release gates; they have not been silently
accepted or marked resolved. No unconditional security/release signoff is given.
Phase 2 should implement and test the evidence authorization boundary before exposing
uploads or AI processing. See [Phase 2 plan](PHASE_2_PLAN.md).

The owner reports testing the protected staging website. The current acceptance
message does not supply its exact deployed SHA, timestamps or browser artifacts;
this report does not infer them from branch HEAD. Record the tested deployment SHA
from Vercel for traceability. Previously supplied stable staging origin:

`https://siteguard-ai-dev-git-dev-foundation-pcgrowthhub-2263s-projects.vercel.app`

Only existing Vercel `siteguard-ai-dev` and Supabase `qaguumtcsshopfeyflrp` are in scope.
No provider setting, infrastructure, migration or production deployment was changed.

## Owner-reported live browser results

These are the owner's successful tests, recorded as supplied, not independently
reexecuted or instrumented by Codex:

| Browser scenario | Reported result |
| --- | --- |
| Email confirmation and login | PASS |
| Password recovery and reset | PASS |
| New password accepted; old password rejected | PASS |
| Session persists after refresh | PASS |
| Logout protection | PASS |
| Company workspace creation | PASS |
| Project creation and persistence | PASS |
| Two companies under one account: switch companies without project mixing | PASS |
| Two independent accounts with separate companies: no cross-company project visibility | PASS |

No additional claim is made about a fresh registration submission, resend behavior,
expired/reused links, mobile devices, direct API requests or Storage downloads beyond
what the owner reported. The browser isolation checks are useful functional evidence;
they do not by themselves prove denial of crafted API writes/deletes.

## Automated evidence and limits

Current run: ESLint PASS; TypeScript PASS; **93 Vitest tests PASS across five files**,
including **27 embedded PostgreSQL security tests** and SDK contracts against a stub
Auth provider. Nine new database cases extend coverage of grants, every non-admin
role, membership removal, multi-company filtering and Storage boundaries.

The first run of the new database cases had five assertion failures because test
cleanup masked an expected RLS error with an aborted-transaction error. The test
harness was corrected to inspect the original denial before rollback; the final
suite passes. This required no application or migration change.

The prior application repair run passed the production build and 14 local
production-browser tests with no live Supabase configuration. Those are historical
results, not rerun hosted acceptance tests in this review. This change affects tests
and documents only. `git diff --check` passes.

Fresh dependency audits: runtime-only audit PASS, zero reported vulnerabilities;
full audit FAIL, five High entries in the existing single development-tool chain.
Audit output is a dependency database observation, not proof of exploitability.

PGlite applies both repository migrations in order, using minimal fixture Auth and
Storage schemas and simulated database roles/JWT subject settings. This exercises
real SQL grants, policies, triggers and functions. It does not prove hosted migration
state, PostgREST authentication, real JWT enforcement, Storage HTTP behavior or
provider configuration. No direct hosted API security test was executed. No usable
Supabase/Vercel management connector is available in this turn.

## Final authorization review

| Resource | Reads | Create/write | Update/delete |
| --- | --- | --- | --- |
| Organizations | Current members only | Authenticated `create_organization` RPC creates a new company plus caller admin membership and audit event atomically | No client grants/policies |
| Memberships | Members of that company may read its membership rows | No client insert; no self-join or promotion RPC | No client grants/policies |
| Projects | Members only | Insert requires company admin and `created_by = auth.uid()` | No client grants/policies, even for admins |
| Audit logs | Company admins only | Server trigger/RPC only; client cannot forge events | No client grants/policies |
| Evidence objects | Authenticated member of exact organization UUID prefix, in private `site-evidence` bucket | No client upload policy; denied even for own company | No client update/delete policies |

All four tenant tables enable RLS. Client grants add a second boundary: SELECT on
these tables and INSERT on projects only. Anonymous roles receive no tenant-table
access or company-creation execution. Changing a hidden organization ID in a form
does not grant authorization; the server obtains the creator identity and the database
checks current membership/role. Dashboard company selection comes from the caller's
membership list and filters projects by that company.

The current product deliberately permits a member to read projects across *all*
companies they belong to via a direct query. UI company selection filters the display;
it is not a separate authorization boundary between two companies where the user
has valid membership. Independent accounts lack those memberships.

Local tests verify cross-tenant project read denial, insert denial, forged creator
denial, UPDATE/DELETE privilege denial, membership insert/promotion denial, all
non-admin project-write denial, and admin-only audit visibility. Revoking a membership
removes table and object visibility for the same identity on subsequent queries.
JWT claims do not carry an authoritative cached company membership in these policies.

The four intentional authenticated SECURITY DEFINER helpers have fixed empty search
paths, qualified references and restricted EXECUTE grants. They derive identity from
`auth.uid()` and cannot arbitrarily join/promote a caller into an existing company.
The trigger helper cannot be called directly by authenticated/anonymous roles.
Table owners and privileged service roles can bypass RLS by design; no such key is
used by the application. Hosted grants/roles and migration drift remain unverified.

## Private evidence storage

The migration creates a private bucket limited to 10 MiB JPEG/PNG/WebP. SELECT is
restricted by both bucket ID and exact first path segment membership. Tests reject
foreign/malformed prefixes and another bucket; own/foreign uploads remain denied,
and object updates/deletes affect zero rows under the fixture policies.

There is no upload UI, signed-link issuance path or content-processing pipeline yet.
Bucket MIME/size settings are not sufficient content validation for Phase 2. Before
uploads ship, implement server-verified company/project/inspection ownership, canonical
keys, byte/content validation, quotas, quarantine, safe image processing and restricted
retrieval. Signed links are bearer access until expiry: use short lifetimes and do
not represent them as immediately revoked when membership changes. Real public URLs,
member/foreign downloads, signing, overwrite and deletion must be tested through
hosted Storage APIs before this feature is released.

## Findings and remaining gates

| Severity | Finding/status | Gate |
| --- | --- | --- |
| Critical | No confirmed finding in reviewed scope | Does not establish absence of all vulnerabilities |
| High | Open development dependency chain: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`; GHSA-vfj7-8cjw-p6xm. Five advisory entries, no compatible fix currently reported | Resolve through a supported update or obtain explicit reviewed tooling-risk acceptance before release; none inferred from browser acceptance |
| Medium | Hosted RLS/grant/migration and direct API/Storage enforcement unverified | Verify deployed policy inventory and execute two-tenant read/insert/update/delete, membership and Storage negative tests before a public release; before Phase 2 upload activation for new policies |
| Medium | No organization/project resource quotas or complete public signup abuse controls | Implement before broad public/commercial exposure; Vercel protection does not guard direct Supabase APIs |
| Low | No CSP | Add compatible CSP as defense in depth before public launch |
| Low | Exact deployment SHA not included with latest owner test results | Record tested SHA and retain this acceptance evidence with deployment metadata |

Built-in Supabase email remains development-only: authorized team addresses, currently
two messages/hour, best effort. The owner has demonstrated functional delivery for
their tests; this does not validate general public email delivery. No domain/SMTP
purchase is needed to continue protected development. Public release will need an
appropriate delivery solution and provider configuration review.

No additional owner authentication retest is required merely because this commit
adds tests/docs. Recheck flows when application/auth configuration changes. Preserve
the reported results; do not keep treating the demonstrated browser journey as
unrun. The remaining security checks are distinct from those successful tests.

## Conditions carried into Phase 2

- Retain protected staging, development Supabase only, `dev/foundation` and open PR #1.
- Capture the owner-tested full deployment SHA without sharing credentials or links.
- Complete hosted API/security verification when authorized access/test fixtures
  are available; management tokens are not necessary for owner-run browser checks.
- Resolve or explicitly review the High tooling risk; keep quotas/CSP tracked.
- Review and test each new policy/migration before enabling uploads or analysis.
- No production deployment, new project or merge into main is approved by this report.
