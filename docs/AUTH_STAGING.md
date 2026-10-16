# Phase 1.5: authentication repair and staging acceptance

## Diagnosed redirect failure

The reported confirmation URL was `http://localhost:3000/?code=…`. That format is
Supabase's default PKCE redirect, not this application's token-hash callback.
The repository previously sent neither an explicit signup redirect nor a recovery
redirect. Its custom templates depended on `SiteURL`, so a localhost Auth Site URL
would send staging users back to their own computer. The app had no PKCE callback
and its landing page did not handle retired code links.

This identifies the configuration/code mismatch from the reported URL and code.
The live Supabase Auth configuration has **not** been read or changed from this runner.
No real confirmation code from the incident was used.

The repair deliberately uses **token-hash verification only**. Signup, resend and
recovery pass the operator-configured `APP_ORIGIN` plus `/auth/confirm`. The templates
use `RedirectTo` and `TokenHash`; the callback calls `verifyOtp`, never PKCE code
exchange. Verification redirects to a clean sign-in URL with a success message;
recovery retains its session and redirects to `/reset-password`. The verification
session is also retained on signup; a password login is offered explicitly before
continuing to the workspace. Protected pages always verify the session server-side.
Retired root/callback `?code=` URLs discard the code and explain how to request a fresh
email or sign in if the old provider link already verified the account.

`APP_ORIGIN` is required and is never inferred from Host or forwarded headers. It
must be an HTTPS origin without user info, path, query or fragment. Explicit HTTP
loopback origins are accepted only for operator-configured local development.

## Exact development-project settings

Only modify **SiteGuard AI Dev**, reference `qaguumtcsshopfeyflrp` (`eu-west-1`).
Do not use production credentials or apply migrations to another project.

First obtain a **READY** deployment of the repaired `dev/foundation` commit in Vercel
project `siteguard-ai-dev` (`prj_y7fZCNyUwEdKfGxE2TaZPaYhwcO5`). Confirm its deployed
commit and build result. Prefer the project's verified stable staging/branch alias:
an immutable deployment URL from an older commit will keep serving older code.
The supplied candidate was
`https://siteguard-ai-21og14625-pcgrowthhub-2263s-projects.vercel.app`.
This runner now reaches it, but receives a redirect to Vercel SSO protection. Its READY state, deployed commit and alias ownership are **unverified**.

Let `STAGING_ORIGIN` be that verified HTTPS origin, with no trailing slash. Set in
Vercel's **Preview** environment for this development branch:

| Variable                               | Value                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://qaguumtcsshopfeyflrp.supabase.co`                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public publishable key from this exact development project; enter securely in settings |
| `APP_ORIGIN`                           | `STAGING_ORIGIN`                                                                           |

Do not use `VERCEL_URL`, request headers, a production database, or another preview's
immutable URL as an implicit redirect fallback. Rebuild the development deployment
after setting variables; public Next.js variables are embedded at build time.
Do not merge `main` or invoke a production deployment.

In this development Supabase project's Authentication → URL Configuration:

- **Site URL:** exactly `STAGING_ORIGIN`.
- **Redirect URLs:** exactly `STAGING_ORIGIN/auth/confirm`.
- Keep `http://127.0.0.1:3000/auth/confirm` and
  `http://localhost:3000/auth/confirm` only if this development project supports those
  explicit local clients. No wildcard domains. Local `APP_ORIGIN` must match the
  address used in the browser.

In Authentication → Email Templates, replace the **Confirm signup** and **Reset
password** templates with `supabase/templates/confirmation.html` and `recovery.html`.
The critical link in each is:

```html
<!-- Confirm signup -->
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=signup"
  >Confirm email</a
>
<!-- Reset password -->
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery"
  >Reset password</a
>
```

These templates and explicit redirect options must be deployed together. Do not use
the default `ConfirmationURL`/PKCE email with this token-hash callback. Enable email
confirmation, minimum 12-character passwords and appropriate Auth email/rate settings.
After changing configuration, request a **new** email through `/resend-confirmation`;
never reuse the incident's code/link. Recovery and resend now report provider failures
without falsely claiming an email request succeeded.

## Security review

Both existing migrations are preserved and now applied in order by the database tests.
The four authenticated SECURITY DEFINER functions are intentional:

| Function                    | Required privilege and boundary                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_organization(text)` | Authenticated caller creates a _new_ organization; identity comes from `auth.uid()`. Organization, own admin membership and audit event are transactional. Cannot join/promote into another organization. |
| `is_member(uuid)`           | Boolean membership of the current authenticated user; avoids recursive membership RLS. Does not return other users' records.                                                                              |
| `is_company_admin(uuid)`    | Boolean admin membership of the current authenticated user; guards project insertion.                                                                                                                     |
| `storage_org_member(text)`  | Boolean membership for the object's organization UUID path prefix. Malformed or other-tenant prefixes fail closed.                                                                                        |

Each has a fixed empty search path and fully qualified database references. PUBLIC
and anon execution are revoked. Authenticated execution remains necessary; removing
it would break RLS or onboarding. `audit_project_creation()` is a trigger-only fifth
definer with direct execution revoked from PUBLIC, anon and authenticated. The review
and tests support keeping these deliberate grants; they do not claim a live advisor
scan or a clean production security audit. Company/project quotas and signup abuse
controls remain prerequisites for a public commercial launch.

## Acceptance gate before Phase 2

1. Verify the repaired staging deployment is READY and points only to the development
   project; check environment-variable names/presence without logging values.
2. Register a synthetic test account, receive a real email, verify it, and observe the
   confirmation success message. Sign in with its password.
3. Create an organization and project; confirm the dashboard and project persist after
   refresh. Sign out, verify anonymous dashboard denial, then sign in again.
4. Request and complete a real recovery email; verify the new password works.
5. Reject expired/reused links and external `next` destinations. Do not capture tokens,
   email links, passwords or cookie values in logs, screenshots or committed artifacts.
6. Verify mobile layout and repeat tenant-isolation tests.

`npm test` includes SDK contract integration against a **stub** provider and real
embedded PostgreSQL RLS tests. Neither is a real email/staging acceptance test.
`LOCAL_SUPABASE_E2E=1 npm run test:e2e` remains a guarded, local-only full journey
suite; it is **not** repurposed to create accounts on an arbitrary hosted project.
Live staging acceptance remains blocked until the approved hosts, development public
key and provider access are available. Phase 2 stays blocked until that gate passes.

### Protected staging access

Keep Vercel deployment protection enabled. For machine acceptance, securely provide
the project's supported automation-bypass secret as `VERCEL_AUTOMATION_BYPASS_SECRET`,
scoped to the approved staging host. Provider management access uses `VERCEL_TOKEN`
and `SUPABASE_ACCESS_TOKEN`; the application's public key must also be made available
to this runner as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A key configured only in
Vercel is not automatically available here. Never paste these values or confirmation
URLs in chat. Do not use production credentials.

## Repaired deployment gate and connected-tool boundaries

The owner independently verified that the existing protected deployment is READY
but contains **87c170e**. That is not the repaired application. Do not point the repaired
flow at that immutable deployment URL. Obtain a protected **Preview** of `dev/foundation`
containing **5d45bbf or a later descendant**, and record its full deployed SHA.

Repository inspection, fixes, local tests, commits, pushes and PR updates can run
through the current GitHub access. Provider changes cannot: management credentials
are not injected here, and current read-only API checks return Supabase 401 / Vercel 403. No new Supabase project or production deployment is needed.

Recommended operator order:

1. Select a stable protected staging/branch alias belonging to `siteguard-ai-dev`.
   Configure **Preview** `APP_ORIGIN` to that exact HTTPS origin, alongside the existing
   development Supabase URL and publishable key. Do not use an old immutable URL.
2. Create a new **Preview** from `dev/foundation` containing `5d45bbf` or later, keeping
   authentication protection on. Do not redeploy the old `87c170e` source and do not
   select a Production target. GitHub push alone does not prove Vercel deployed it.
3. Verify **READY**, exact deployed SHA, project identity and alias assignment. Only
   then apply the Site URL, exact callback allowlist and the two committed token-hash
   email templates to the existing development Supabase project as described above.
4. Run metadata preflight and then the real email-to-dashboard/recovery acceptance.

A new read-only command is available:

```sh
npm run staging:check
```

It requires secure `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, and operator-chosen
`APP_ORIGIN`. It defaults to the current full Git HEAD; `EXPECTED_STAGING_COMMIT` can
select a specific full SHA. The CLI rejects commits that do not include `5d45bbf`.
If Vercel requires an explicit team scope, set non-secret `VERCEL_TEAM_ID` as well.
All provider calls are GET requests restricted to the existing development projects.
No deployment, setting change, key creation, merge or production write is performed.
Missing configuration exits 2; a failed/incomplete gate exits 1.

The command checks READY state, exact SHA, Preview target, approved project, alias,
protection metadata, Preview variable **names**, and Supabase Site URL, exact redirect,
confirmation requirement and token-hash templates. Vercel variable **values are not
inspected**: the deployment's actual Supabase URL/key and APP_ORIGIN still need secure
operator validation. Neither a green metadata check nor its fixture tests prove real
email delivery, provider sessions or the acceptance journey.

For protected browser acceptance, supply `VERCEL_AUTOMATION_BYPASS_SECRET` through
secure settings for the selected approved host; do not disable protection. A new
stable hostname must be explicitly allowed for that secret before using it there.
