# Protected staging acceptance: minimum-access handoff

## What existing connected access can do

GitHub access can inspect and update `dev/foundation`, maintain draft PR #1, and
inspect repository CI. The `validate` check passed for `cc83340`. The only accessible
Actions workflow is `Validate`; it contains no deployment steps. GitHub deployments,
commit deployment statuses, and Vercel PR bot comments currently expose no deployment.
Webhook and repository-secret metadata are denied to this integration. This does not
prove the Vercel Git integration is absent; it means no deployment operation is
available through the current GitHub connection.

No callable Vercel or Supabase connector is present in this session. Without provider
credentials, project-management reads return Vercel HTTP 403 / Supabase HTTP 401.
The known staging host returns a redirect to Vercel SSO. That proves its protection
is active, not that the repair is deployed. The owner confirmed its READY commit is
`87c170e`, which predates the authentication repair.

There are two supported paths. **Management tokens are not required for the dashboard
path below.** All work targets the existing Vercel `siteguard-ai-dev` project and
Supabase development project `qaguumtcsshopfeyflrp`. Keep production and main untouched.

## Path A: existing dashboards, no management tokens

1. In the existing Vercel project, create a **Preview** from the latest
   `dev/foundation` commit containing `cc83340` or a later descendant. Verify the
   selected source SHA; redeploying the old `87c170e` deployment reuses old code.
   Keep authentication protection enabled. If using Git integration, inspect its
   repository/branch connection and Preview deployment result; a Git push alone is
   not proof of a new deployment. Do not select a Production target or create a project.
2. Verify the new deployment is **READY**, record its full source SHA, and select an
   existing or newly assigned stable HTTPS staging/branch alias belonging to this
   project and this Preview. Do not use the old immutable deployment URL.
3. Only after that verification, set Vercel **Preview** `APP_ORIGIN` to the exact
   stable origin, without a trailing slash. Confirm Preview's existing
   `NEXT_PUBLIC_SUPABASE_URL` is `https://qaguumtcsshopfeyflrp.supabase.co` and its
   publishable key belongs to that same project. No export of that key into chat or
   Codex is needed for browser testing of the hosted application.
4. Rebuild the same repaired source as a protected **Preview** so its variable
   configuration is applied. Recheck **READY**, full SHA and stable-alias assignment.
5. In the existing development Supabase project's Auth URL settings, set:
   - Site URL: the verified stable origin.
   - Redirect URL: exactly `<verified-origin>/auth/confirm`.
   - Keep explicit localhost callbacks only for intentional local development;
     avoid wildcard staging redirects.
6. Apply `supabase/templates/confirmation.html` to **Confirm signup** and
   `supabase/templates/recovery.html` to **Reset password**. They use `.RedirectTo`,
   `.TokenHash`, and `type=signup` / `type=recovery`. Do not combine default
   ConfirmationURL/PKCE templates with the token-hash callback. Require email
   confirmation and minimum 12-character passwords.
7. Share only the non-secret verified URL, full source SHA and READY result with
   Codex. Add the exact new hostname to this Codex environment's allowed destinations.
   For automated protected browser access, securely configure the project's supported
   automation-bypass secret for that hostname as `VERCEL_AUTOMATION_BYPASS_SECRET`.
   Keep protection on; do not paste the secret or an email confirmation URL into chat.

The existing cloud draft's `APP_ORIGIN` suggestion still names the old immutable
host. Replace that suggestion in environment settings rather than applying it as the
repaired origin. A Codex runtime binding and a Vercel Preview variable are separate:
one does not configure the other.

## Path B: agent-operated management, only if desired

Supply credentials through **Codex environment settings → secrets/variables**, not
chat, repository files, PR comments, command arguments, or screenshots. Use the
shortest practical expiry, restrict proxy delivery to the named API host, and revoke
access after acceptance. Review/save environment settings and publish the cloud
configuration when appropriate; this is separate from deploying Vercel.

| Binding                           | Minimum needed capabilities                                                                                                                                                                                                                                                                                                   | Allowed destination             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `VERCEL_TOKEN`                    | Read this project's deployments/aliases, source SHA, READY state, build logs and Preview variable metadata; create **Preview** deployments and update only the needed Preview variables if delegating those writes. No project creation, protection removal, production deployment or production-variable changes are needed. | `api.vercel.com`                |
| `SUPABASE_ACCESS_TOKEN`           | Read and update **Auth configuration only** for `qaguumtcsshopfeyflrp`: Site URL, redirect allowlist, signup/recovery templates and confirmation settings. No project creation, SQL/database administration, storage administration or unrelated-project changes are needed.                                                  | `api.supabase.com`              |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Supported machine HTTP access through deployment protection for the approved staging host; no provider-management or deployment privileges.                                                                                                                                                                                   | Exact verified staging hostname |
| `APP_ORIGIN`                      | Non-secret verified stable HTTPS origin, supplied to the runner for metadata preflight and separately to Vercel Preview for the application.                                                                                                                                                                                  | Not a credential                |

These are **required operations, not claims that each provider offers a token scope
with those exact boundaries**. Personal tokens can inherit wider account/team access.
Use a role/scope limited to the development project/team where the provider supports
it; if it cannot be sufficiently limited, prefer Path A instead of granting broad
account access. Supabase's publishable/anon key is not a management credential; do
not substitute a database service-role key. Vercel's bypass secret does not grant
management API access.

Once access exists, `npm run staging:check` is a read-only metadata/Auth check. It
verifies the selected exact commit and configuration; it does not deploy, apply
settings, inspect Vercel variable values, or prove the real authentication journey.

## Real acceptance after deployment and configuration

Use a dedicated staging test address. The test must establish actual email delivery
and confirmation, not an admin-generated link or stub. A controlled test inbox or
owner-assisted email click is needed; label any owner-assisted step explicitly.
Never transmit confirmation links, codes, passwords or session cookies in chat.

Record outcomes separately for:

- Fresh registration → actual confirmation email → successful confirmation message.
- Password sign-in → organization creation → project creation → dashboard persistence
  after refresh.
- Sign-out → anonymous dashboard denial → sign-in again.
- Actual recovery email → reset → successful new-password sign-in.
- Expired/reused-link denial, mobile usability and tenant isolation.

Until those live checks execute, the real journey remains **blocked/unverified**.
Local fixtures, CI success, a protected redirect, and READY metadata are separate
pieces of evidence. Phase 2 remains on hold.
