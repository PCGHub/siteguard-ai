# Validation report

## Current runner

- Node.js 24.19.0, Next.js 16.4.2, React 19.3.1, TypeScript 6.0.3.
- `npm ci --cache /workspace/.npm`: passed from the committed lockfile.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 24 passed (7 validation + 17 PostgreSQL migration/RLS tests).
- `npm run build`: passed, including framework type checking.
- `npm run test:e2e` with system Chromium: 6 passed, 0 skipped; desktop and mobile.
  These public tests ran against the production build with no Supabase bindings.
- `npm audit --omit=dev --audit-level=high`: 0 known runtime vulnerabilities.
- Full local Supabase browser acceptance: pending local container startup.

The migration was executed in embedded PostgreSQL (PGlite), with minimal test fixtures
for Supabase-owned auth/storage schemas. Tests exercise grants, RLS, organization
creation, project creation/persistence, audit events, role escalation denial,
cross-tenant read/write/delete denial and private storage-object isolation.
They do not establish that a hosted Supabase project's Auth or Storage HTTP APIs work.

## Diagnosed setup failures

- npm's default home cache is unwritable; workspace cache resolved installation.
- Latest Supabase CLI cannot initialize its configuration in the read-only home.
  A standalone 2.75.0 binary was fetched from the official release with SHA-256
  verified against the official release checksum file. No verification was disabled.
- Default Supabase ECR registry was denied; Docker Hub access works.
- Full optional-service downloads exhausted disk and interrupted one test run.
  Removed only images/cache downloaded during this task and reduced local services;
  the interrupted tests and build subsequently passed.
- Browser tests initially exposed an absolute redirect using the wildcard bind host;
  confirmation responses now use fixed relative destinations. Rerun passed.
- A development-server restart during a test run interrupted navigation; final public
  browser checks use a stable production build and passed.

## External access and approval boundaries

GitHub repository reads and dry-run branch push succeeded. GitHub API requests return
Forbidden, so pull-request API creation is not yet verified. No usable Supabase or
Vercel bindings are injected; management API requests are blocked by network access.
Official hosted documentation was also denied by the network policy; bundled Next.js
API/auth documentation and installed SDK types were consulted.

No hosted project was created, no remote migration applied, no Vercel deployment
performed, and no production credentials used. Owner action is required to select an
isolated development Supabase project, apply/review its migration, configure Auth/email,
and import the repository into an approved Vercel team with Preview variables.
Production deployment and production credential use require separate explicit approval.

GitHub Actions configuration exists but its remote execution is not claimed here.
