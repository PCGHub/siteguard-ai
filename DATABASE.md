# Database and authorization

Versioned migration: `supabase/migrations/202610150001_foundation.sql`.

- `organizations`: company identity; members can read.
- `organization_members`: composite company/user key; five constrained roles.
  Members can read their company's memberships. No direct client mutations.
- `projects`: tenant foreign key, validated name/industry/location, authenticated
  creator, tenant-unique name. Members read; company admins insert.
- `audit_logs`: append-only organization/project creation events. Company admins read.

All public tables use RLS and explicit least-privilege grants. Updates and deletes
are deliberately unavailable in milestone 1. Restrictive foreign keys preserve
history. No invitation/role-management RPC is exposed yet. Only creation of a new
company grants its creator admin; a user cannot join or promote themselves in an
existing company. `create_organization` atomically creates company, owner membership,
and audit event; no caller-supplied role/user ID is accepted.

Definer membership helpers avoid recursive membership RLS, use an empty search path,
and always derive user identity from `auth.uid()`. Public execution is revoked.
The migration owner remains privileged and must be a trusted operator.

`site-evidence` is private, 10 MiB maximum, JPEG/PNG/WebP allowlist. Object key prefix
must be the company UUID for reads. Malformed prefixes fail closed without UUID casts.
Writes have no policies until server-side content validation exists. Storage service
administrators can bypass policies; privileged credentials are outside the app.

Run `npm run db:test` for PostgreSQL policy tests. Fixtures create only the minimal
Supabase-owned schemas. Passing those tests does not prove hosted API configuration.
Apply migrations on an approved development project before a hosted acceptance test.
Backups and retention are operational requirements before production.

## Inspection management

Migration `202610160002_inspection_management.sql` adds inspections and immutable
history with a composite company/project FK, member-only SELECT RLS and narrowly
authorized mutation RPCs. Clients have no direct write/delete grants. A trigger
records versions, actor identity and audit events. See
[the schema and workflow guide](docs/INSPECTION_MANAGEMENT.md). Both foundation and
inspection database suites run with `npm run db:test`. Hosted application is pending.
