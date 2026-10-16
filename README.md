# SiteGuard AI

Enterprise Workplace Safety Intelligence — See the Hazard. Visualize the Solution.

Milestone 1 implements Next.js App Router, Supabase email/password authentication,
email confirmation and recovery, transactional company onboarding, company-scoped
project creation, and a responsive dashboard showing real authorized projects.
Inspections, AI, invitations, billing, and uploads are later milestones.

## Requirements and quick start

Node.js 24, npm, and a **development** Supabase project. Docker is optional for
local Supabase. No service-role key, AI key, or production credentials are needed.

```sh
npm ci
cp .env.example .env.local
# Set the development project's URL and publishable key in .env.local.
npm run dev
```

Set `APP_ORIGIN` to your exact application origin (local: `http://127.0.0.1:3000`). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using
Supabase Project Settings → API. These are public identifiers, not privileged
credentials; authorization is enforced by PostgreSQL RLS. Never put a secret or
service-role key in a `NEXT_PUBLIC_` variable.

## Configure Supabase (development only)

1. Create/select an isolated development Supabase project, not production.
2. Apply `supabase/migrations/202610150001_foundation.sql` with the SQL editor,
   or link the CLI to that development project and run `supabase db push` after
   reviewing the target and migration. Do not run remote migrations without the
   project owner's approval.
3. Enable email/password sign-up, **email confirmations**, minimum password length
   12, secure email changes, and refresh-token rotation. Configure Auth rate limits
   and production SMTP before any public release. Enable CAPTCHA before public
   registration if abuse protection is required; the app currently has no CAPTCHA UI.
4. Set Auth Site URL to the exact app origin (local development uses
   `http://127.0.0.1:3000`). Restrict redirect URLs to owned origins.
5. Copy `supabase/templates/confirmation.html` and `recovery.html` into the matching
   Auth email templates. Their token-hash links use the explicit `RedirectTo` pointing at `/auth/confirm`, which establishes
   the cookie session server-side. Default fragment-based templates are not supported.
6. Add the two public environment variables and server-only `APP_ORIGIN`, restart Next.js, then register, confirm
   email, create a workspace, and create a project. Refresh to verify persistence.

### Local Supabase

```sh
npm run db:start
npm run db:reset   # DESTRUCTIVE to local data only; never use on a remote project
```

The committed config enables confirmations and uses Mailpit for local email capture.
Read the local API URL and public key from `supabase status`, placing only those two
values into `.env.local`. Do not copy service-role keys into application configuration.
Open local Mailpit on port 54324 to confirm signup or recover a password.

This cloud runner's latest CLI cannot write to its read-only home directory. During
validation a checksum-verified Supabase CLI 2.75.0 binary outside the repository was
used instead. Its default ECR registry was denied; setting
`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` uses Docker Hub without disabling checks.
A normal workstation can use the npm-installed CLI. This runner also uses Docker `vfs`: even the reduced official stack exhausted its 32 GB disk during PostgreSQL image unpacking. Use an approved hosted development project or a Docker environment with sufficient disk and an appropriate storage driver. Full local authentication tests remain unrun here. CLI startup status can include
local credentials: never publish or paste its full output.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` includes real PostgreSQL RLS tests through PGlite with minimal fixtures for
Supabase-owned `auth` and `storage` schemas. These tests exercise SQL policies,
grants, triggers and transactions, not hosted Auth/Storage HTTP APIs.
`npm run db:test` runs just that suite. Browser tests cover desktop/mobile public
entry, missing-configuration handling and rejected confirmation links. Additional
local-Supabase browser tests are documented in the validation report when available.
For system Chromium set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

## Vercel deployment preparation

Import `PCGHub/siteguard-ai` into Vercel with the **Next.js** framework preset and
Node.js 24. The committed `vercel.json` selects `npm run build` and `npm ci`. Add the two
Supabase variables and server-only `APP_ORIGIN` to **Preview** using a separate development Supabase project.
Do not point previews at production customer data. Set the Supabase Auth Site URL
and templates for the chosen stable preview URL. Arbitrary preview hostnames are
not enabled automatically. No Vercel token is stored in this repository.

Review the development deployment, database tests, email delivery and security
limitations before approving any production project, secrets, migration or release.
Production deployment has not been authorized or performed by this scaffold.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md),
[SECURITY.md](SECURITY.md), and [docs/VALIDATION.md](docs/VALIDATION.md).

### Full local authentication acceptance test

After starting local Supabase, configuring `.env.local`, and rebuilding, run:

```sh
LOCAL_SUPABASE_E2E=1 npm run test:e2e
```

This creates synthetic accounts in local Supabase and reads only their confirmation
and recovery messages from local Mailpit. It tests verification, login/logout,
onboarding, project creation, refresh persistence, password recovery, and mobile
layout. It must not be pointed at a hosted or production project.

For the Phase 1.5 redirect repair, exact development-project settings and the live acceptance gate, see [docs/AUTH_STAGING.md](docs/AUTH_STAGING.md). Do not begin Phase 2 until the real email-to-dashboard journey passes.

`npm run staging:check` performs read-only deployment/Auth metadata preflight after secure management access is configured. It verifies the exact requested commit and never deploys or changes provider settings; see [the staging deployment gate](docs/AUTH_STAGING.md#repaired-deployment-gate-and-connected-tool-boundaries).
