# Phase 2 · Milestone 1: inspection management

Implemented on `dev/foundation`, extending baseline `fab7763`. No hosted migration,
production deployment, new infrastructure, photo upload, AI processing, corrective-
action approval or PDF generation is part of this change. Phase 1.5 owner-reported
acceptance remains recorded in [the sign-off review](PHASE_1_5_SIGN_OFF.md).

## Implemented workflow

Company dashboard/project links lead to `/inspections`. The server-rendered list
uses the signed-in caller's memberships, company-scoped queries, title search,
project/status/inclusive UTC date filters and 20-record pages with deterministic
ordering. Company selection is explicit. Invalid filters show guidance and the
first unfiltered page of the authorized company; they never broaden tenant access.

`/inspections/new` creates a persisted draft for an authorized project. Records
include title, project, work area, inspection time, inspector display name,
description and observations. Dates are entered/labeled in UTC, from 2000 through
2099. The account recording the inspection is independently captured from `auth.uid()`;
the display name is user-entered text, not verified identity or assignment authority.

`/inspections/[id]` shows the record, current state/version and the latest 200 immutable
history events, newest first. `/inspections/[id]/edit` allows the author's draft
fields to be edited. Project, company and author remain fixed; a different project
requires a new draft. Required fields and length/date bounds are validated in forms,
server actions and PostgreSQL. Loading, pending buttons, empty states, generic errors,
read-only/permission guidance and inaccessible-record pages are included. Text is
React-escaped; no real/fake inspection records are seeded into product screens.

### Permission matrix and product decisions

| Role | Read company records/history | Create own draft | Edit/submit own draft | Begin another author's review | Complete assigned review |
| --- | --- | --- | --- | --- | --- |
| Company admin | Yes | Yes | Yes | Yes | Yes |
| HSE manager | Yes | Yes | Yes | Yes | Yes |
| HSE officer | Yes | Yes | Yes | No | No |
| Supervisor | Yes | Yes | Yes | No | No |
| Viewer | Yes | No | No | No | No |

These are inspection-specific capabilities. Existing project creation remains admin-
only; no role gains membership administration or unrestricted editing of colleagues'
records. Company admins cannot edit/submit someone else's draft. The inspector name
is a display field; author and reviewer account IDs cannot be supplied by the client.

Explicit transitions, enforced by the database:

- Draft → Submitted: author with a writing role; submission locks draft fields.
- Submitted → Under Review: another current company admin/HSE manager; assigns the
  acting reviewer. Self-review is denied even for admins.
- Under Review → Reviewed: that assigned reviewer, still holding a reviewer role,
  with 10–4000 characters of human review notes.

No skips, reverse transitions, reopening, reassignment or self-approval. “Reviewed”
records completion of a human review, **not a declaration that a site is safe** or
approval of corrective actions. A single-person company can create/submit but needs
another qualified member to complete review. Membership invitations/role administration
are not implemented; use an existing appropriately provisioned development tester.
Do not add broad client membership policies to enable testing.

These conservative decisions implement the milestone without blocking on optional
product choices. Before expanding review actions, the owner should decide reviewer
qualifications, delegation/reassignment when a reviewer leaves, return-for-correction,
reopening, retention/deletion and whether future workflows ever permit self-review.
The current implementation forbids it. No automatic review/approval exists.

## Schema and security

Migration: `supabase/migrations/202610160002_inspection_management.sql`.

- Adds `(organization_id,id)` uniqueness on projects and a composite inspection →
  project foreign key. Even a table owner cannot attach an inspection to a project
  in a different company without violating the FK.
- Adds `inspections`: company/project, required fields, generated ID, request key,
  `created_by`, state, positive version, reviewer/note, submit/review/create/update
  times. Checks bound text/date/state consistency and disallow author=reviewer.
- Adds `inspection_history`: company/inspection composite FK, database actor,
  event/from/to state, version and time; one event per inspection version.
- Indexes support company/date ordering, project/status filtering, creators,
  reviewers and history lookup. Title search uses escaped substring patterns;
  no full-text search infrastructure is introduced.
- Both tables enable RLS with member-only SELECT. Anonymous access and all direct
  client INSERT/UPDATE/DELETE are revoked, including direct history writes.
- Only `create_inspection`, `update_inspection_draft` and `transition_inspection`
  accept authenticated mutations. Each SECURITY DEFINER function has an empty
  fixed search path, qualified references, identity from `auth.uid()`, explicit
  membership/role checks and no PUBLIC/anonymous execute grant.
- Member rows are locked FOR SHARE while authorizing; existing records are locked
  FOR UPDATE before edits/transitions. A mandatory expected version prevents stale
  writes/duplicate transitions. The same assigned reviewer must finish review.
- Creation has a unique `(created_by,request_id)` key. Repeating an unchanged create
  request returns the same ID with one history event; a reused key with different
  data fails. The form generates its request key server-side. Edits after creation
  can make a replay of the original payload invalid; reopen the existing record.
- A trigger records history and `inspection.*` events in existing company audit logs
  transactionally. Its execution is revoked for client roles; no actor field is
  accepted by mutation RPCs. History records events/versions, not full field snapshots.
- Revoked membership removes subsequent reads/writes, even with the same user JWT.
  No role claim from a form, URL or display name grants company access.
- No service-role key is used. Private evidence storage policies are unchanged.

Superusers/service roles intentionally bypass RLS; application requests use the caller's
session. Authorization is in SQL, not merely hidden UI controls. Errors sent to users
avoid SQL/provider detail. A stale-form failure does not save client edits; reopen
and reapply them. Server validation/provider redirects may clear unsaved form inputs.

## Validation evidence

See [VALIDATION.md](VALIDATION.md) for final command results. The inspection database
suite runs all migrations in order against PGlite, with minimal Supabase Auth/Storage
fixtures and simulated identities. It exercises actual PostgreSQL constraints,
privileges, RLS, functions, trigger history and transactions. SDK/server-action mocks
and validation tests exercise application wiring. These are **not hosted Supabase
API tests**. Sequential stale-version tests demonstrate optimistic concurrency;
separate live concurrent PostgREST transactions/lock scheduling remain unverified.

The local-only Mailpit browser journey was extended to create/edit/submit, filter,
refresh and revisit after logout/login. It remains unrun on this cloud machine due
to the previously diagnosed full Supabase Docker disk limitation. The ordinary
browser suite exercises public/auth regressions and anonymous inspection denial,
not authenticated hosted inspection forms. No authenticated browser or hosted API
inspection success is claimed.

## Owner acceptance on protected development staging

1. Review the new migration and apply it **only** to development Supabase
   `qaguumtcsshopfeyflrp`. Check existing schema/migration history first: if foundation
   migrations were applied manually, do not blindly run every pending CLI migration.
   The SQL editor can apply this new versioned migration after target/schema review.
   No `db reset` on a hosted database. Keep a recovery/forward-fix procedure; do not
   drop inspection tables with data to roll back a UI deployment.
2. Obtain a protected non-production READY deployment of this commit or later from
   `dev/foundation`. Record full SHA/stable alias. Retain Vercel protection and existing
   APP_ORIGIN, Supabase URL/key and working default-email settings. No new env vars
   or management/service-role credentials are needed for owner browser testing.
3. Sign in as a writing member, choose company/project, create a draft using synthetic
   notes. Refresh detail/list, sign out, sign back in and reopen the record. Check
   recorded company/project, UTC time, inspector name and author account.
4. Edit your draft and verify updated fields/history. Open two edit tabs, save one,
   then submit the stale form: expect a conflict with no overwrite. Duplicate-submit
   an unchanged form/request: one transition/version only. A newly opened create
   form represents a new request and can intentionally create another record.
5. Filter title/project/date/status and switch companies. Submit a draft and confirm
   editing disappears. Try self-review: denied. A separate admin/HSE manager begins
   review and records notes to mark Reviewed; no other reviewer may finish it.
6. With provisioned company roles, verify officer/supervisor authors can create/edit/
   submit, viewer is read-only, and a second-company account cannot read details or
   history or mutate records. Role provisioning is an operator task, not a new UI.
7. Execute direct API negative tests with dedicated development accounts: foreign
   project references, forged author/status, direct table/history writes/deletes,
   invalid transitions, missing version, revoked membership and two competing
   reviewers. No API tokens, passwords or screenshots of sessions in chat/Git.
8. Recheck Phase 1.5 login/recovery/logout and mobile layout on staging. Record exact
   deployment and actual results separately from the existing owner-reported Phase
   1.5 tests. Those reports do not cover these new inspection features.

Hosted migration/application acceptance is pending operator access. No remote SQL or
provider changes were performed by this implementation. The code and local tests are
complete; hosted persistence after a new login and real API enforcement must still
be accepted live before declaring this milestone operationally complete.

## Limitations and next milestone

No attachments/uploads, AI hazard scanning, corrective-action approval, PDF reports,
invitations, draft deletion, reassignment or reopen flow. No resource quotas or
comprehensive public abuse controls yet. Built-in email remains development-only.
The existing High `braces` lint-toolchain advisory remains open; runtime audit results
and release gates are tracked in validation/sign-off documents. Resolve or explicitly
review the development-tool risk; CSP/quotas and deployed-policy/API checks remain
before public exposure.

Next: **Secure Photo Evidence Upload**, starting with evidence metadata constrained
to company/project/inspection, canonical keys, content/quota validation, quarantine,
private retrieval, revocation-aware short-lived links and real Storage API negative
tests. Preserve current deny-by-default storage writes until that workflow is tested.
Follow [PHASE_2_PLAN.md](PHASE_2_PLAN.md); no AI or reporting integration is needed yet.
