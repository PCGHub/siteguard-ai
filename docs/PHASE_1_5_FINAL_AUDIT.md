# Phase 1.5 final staging audit

> Historical audit of the token-hash-only implementation. The subsequent
> default-email repair supersedes its template and PKCE guidance; see
> [current authentication instructions](AUTH_STAGING.md). Live acceptance remains required.

Audit date: 2026-10-16. Repository: PCGHub/siteguard-ai. Development branch: dev/foundation.

## Decision

**Phase 1.5 is ready for live acceptance testing, but is not signed off for Phase 2.** Local checks pass. Hosted authentication, provider configuration and live tenant/storage isolation still need evidence. One High development-tool dependency advisory remains open. No Critical or High runtime vulnerability was confirmed in the reviewed source; this is not a security certification.

## Deployment and source evidence

The fetched branch head before this audit matched the owner's deployed SHA exactly: `ea487c5df7c523939fc945aa5fe614dc79627904`. The owner independently verified READY, Staging, protection enabled and Preview APP_ORIGIN set to:

`https://siteguard-ai-dev-git-dev-foundation-pcgrowthhub-2263s-projects.vercel.app`

Those deployment properties were not independently confirmed through provider APIs during this audit. The fixes in the audit-fix commit containing this report descend from that SHA and are **not included in the owner-verified deployment**. Redeploy that commit to protected development staging before final acceptance.

Only the existing Supabase development project `qaguumtcsshopfeyflrp` is in scope. No infrastructure settings were changed, no production deployment was made, and PR #1 remains unmerged.

## Findings

| Severity | Finding | Status / impact |
| --- | --- | --- |
| Critical | No confirmed finding in reviewed scope | Live verification is incomplete. |
| High | Development dependency denial of service, GHSA-vfj7-8cjw-p6xm | Open. Five npm High entries describe one `braces` chain through `micromatch`, `fast-glob`, `@next/eslint-plugin-next` and `eslint-config-next`. Runtime-only audit reports zero vulnerabilities. Compatible `npm audit fix` did not resolve it; forced repair proposes an incompatible major lint-config downgrade. Use a supported upstream repair or explicitly record bounded tooling-risk acceptance. |
| High (assurance gap) | Live Auth configuration and end-to-end acceptance unavailable | Unverified, not a confirmed exploit. Site URL, redirect allowlist, email templates, email delivery, deployed RLS and Storage HTTP enforcement have not been inspected/tested live. Blocks final signoff. |
| Medium | Password update reported sign-out success when provider logout failed | Fixed: preserve truthful error state and expose a Sign out retry. Tests cover failure and success. Requires redeployment. |
| Medium | No application quotas for organization/project creation | Open before public commercial exposure. Any authenticated account can create its own resources; direct Supabase access bypasses Vercel protection. Agree quotas and provider abuse controls before opening registration broadly. |
| Low | Inconsistent/unbounded login and recovery input | Fixed: shared email maximum 254 and login password maximum 128; malformed input rejected before provider calls. Existing short-password login remains supported. |
| Low | Reset form rendered without a verified session | Fixed: dynamic reset route checks the current user and redirects anonymous access to recovery guidance. The mutation already checked authentication; this was not an authorization bypass. |
| Low | Preflight rejected Vercel's Staging target | Fixed: accept non-production Preview/Staging, select expected commit and prefer READY. Production still rejected. |
| Low | Content Security Policy absent | Open defense-in-depth work before public launch; no raw HTML rendering/eval sink was found in application review. Existing frame, MIME, referrer and permissions headers remain. |

Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

## Authentication and configuration review

APP_ORIGIN is mandatory for auth redirects and validates an exact HTTPS origin (HTTP allowed only for explicit loopback development). Request Host is not used as the redirect authority. Signup, resend and recovery explicitly redirect to `/auth/confirm`. Committed signup/recovery templates use `.RedirectTo`, `.TokenHash` and the appropriate token type. The confirmation route accepts only signup/recovery OTP types, verifies through Supabase, uses fixed relative destinations and sets no-store/no-referrer. Retired code callbacks remove codes and guide users to request fresh messages.

Successful signup confirmation creates a verified session and redirects to the login success screen; that screen is not a second authentication gate. Dashboard, onboarding and organization/project mutations verify the user with `getUser`. Logout clears the session through the SDK. Reset requires a valid session, validates the password and reports logout failure accurately. Cookies use HttpOnly, SameSite Lax and Secure in production. Provider reauthentication/password policy settings remain unverified.

**Unverified provider checks:** Site URL equals the stable origin; allowed redirects include the exact stable `/auth/confirm`; signup and recovery templates match the committed templates; email confirmations are enabled; email delivery, rate limits, password policy and public development Supabase variables are correct. APP_ORIGIN is owner-reported configured, not runtime-verified here.

## Database and private storage review

Both existing migrations were exercised in PGlite with Supabase-like auth/storage fixtures. They were not modified. RLS covers organizations, memberships, projects and audit logs. Membership controls reads; project insert requires company administrator status and `created_by = auth.uid()`. Client update/delete privileges are absent. Organization creation atomically creates the caller's organization, administrator membership and audit entry; it cannot join or promote a caller into an existing company.

Intentional authenticated SECURITY DEFINER helpers have fixed empty search paths, qualified references and restricted EXECUTE grants. PUBLIC/anonymous execution and direct trigger-helper execution are revoked. Local tests check cross-tenant reads/writes, roles and function grants.

`site-evidence` is private, limited to 10 MiB JPEG/PNG/WebP. Reads require membership in the organization UUID path prefix. No client upload/update/delete policies or upload UI are implemented. Actual Supabase Storage HTTP behavior is unverified. Phase 2 upload work needs its own authorized upload and file-validation design.

## Checks actually executed

| Check | Result and limit |
| --- | --- |
| ESLint | PASS |
| TypeScript | PASS |
| Vitest | PASS: 64 tests, including 18 PGlite database tests and SDK auth contracts against a stub provider; not live Supabase |
| Production build | PASS; protected/reset routes dynamic |
| Playwright | PASS: 14 desktop/mobile tests against local production build without live Supabase settings; zero skipped |
| Runtime dependency audit | PASS: zero reported vulnerabilities with `--omit=dev` |
| Full dependency audit | FAIL: five High entries in the development-tool chain above; zero Critical |
| Compatible npm audit fix | Did not resolve the advisory; no dependency/lockfile change retained |
| Git secret pattern scan | No matching credentials in 102 reachable textual Git blobs at baseline; bounded pattern scan, not exhaustive assurance |
| Migration diff | Existing migrations unchanged |
| Read-only staging preflight | BLOCKED: exit 2, missing VERCEL_TOKEN and SUPABASE_ACCESS_TOKEN |
| Provider read probes | Supabase Auth API 401; Vercel project API 403; no authenticated configuration inspection |
| Stable staging HTTP probe | BLOCKED: environment proxy CONNECT 403 for the stable hostname; not evidence of application failure |
| Real signup/confirmation/login/reset | NOT RUN; no live success claimed |

No private keys or service-role credentials were used. Test credentials are synthetic fixtures. Validation errors remain user-safe; server/provider diagnostics require normal operational monitoring without logging tokens or confirmation links.

## Available operations and secure configuration

Repository inspection, local tests, development fixes, Git commits/push and PR updates are available with existing access. Authenticated Vercel/Supabase deployment/configuration operations are unavailable with currently injected tools/credentials. Do not request tokens in chat.

The owner can perform provider checks and protected staging redeployment directly in existing dashboards without supplying management tokens. If automation is desired, inject `VERCEL_TOKEN` with only the existing development project's deployment/read and necessary Preview configuration permissions, and `SUPABASE_ACCESS_TOKEN` with only development Auth configuration/read access where the provider supports that scope. If tokens cannot be narrowed to these resources, prefer the owner-operated workflow. Current preflight needs authenticated deployment metadata and Auth configuration reads; it does not need a Supabase service-role key.

Allow the exact stable hostname in the Codex network settings. For automated access through protection, securely configure `VERCEL_AUTOMATION_BYPASS_SECRET`; keep protection enabled. Ensure Vercel Preview has `APP_ORIGIN`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as documented in the repository. Public Supabase keys do not substitute for management API access. Do not put any token or email confirmation link in chat or Git.

## Required acceptance gate before Phase 2

1. Redeploy the audit-fix commit or later from dev/foundation to protected development staging. Record full SHA, READY status and stable HTTPS alias. Retain protection; do not merge or deploy production.
2. Verify the exact APP_ORIGIN and Supabase Site URL, `/auth/confirm` allowlist, signup/recovery templates and email-confirmation settings in the existing development projects. Run the read-only preflight with available secure access.
3. Use a dedicated real test inbox or owner-assisted browser session: fresh signup → received confirmation → confirmation success → explicit password sign-in → organization → project → dashboard refresh → logout → anonymous route denial → sign-in again. Record actual results without sharing tokens.
4. Exercise real password recovery: received message → valid reset → new password sign-in; old password rejected. Check expired/reused links do not create a fresh session. Confirm session cleanup and failure messages.
5. Use two real development tenants to verify REST reads/writes and membership/role isolation. With an authorized synthetic evidence fixture, verify public/foreign Storage access denied and member read allowed. PGlite fixtures cannot replace these live tests.
6. Resolve the High tooling dependency or record an explicit reviewed development-only risk decision. Track resource quotas/abuse controls and CSP before public commercial launch.

Only after these results are recorded can Phase 1.5 be signed off. Local test success alone does not establish live authentication acceptance.
