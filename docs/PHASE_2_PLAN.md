# Phase 2 implementation plan

> Inspection Management code and embedded tests are now implemented; hosted acceptance
> is pending. See [Milestone 1 delivery](INSPECTION_MANAGEMENT.md). Subsequent sections
> remain a plan; uploads, AI, corrective actions and reports are not implemented.

Scope: safety inspections, private photo evidence, preliminary hazard identification,
human review and reports. Build incrementally on `dev/foundation`, using the existing
protected staging and development Supabase project. This document is a plan, not a
claim that these features exist or authorization to create external infrastructure.
[Phase 1.5 acceptance evidence and remaining security gates](PHASE_1_5_SIGN_OFF.md)
carry forward.

## 1. Inspection records and authorization

Deliver an inspection list/detail flow per company/project with title, location,
inspection time, inspector, notes and draft/submitted state. Company/project context
must be verified server-side; never trust a selector, object path or AI output.

Proposed tables: `inspections`, `evidence`, `analysis_jobs`, `hazard_findings`,
`human_reviews`, `corrective_actions` and `report_versions`. Every row carries
`organization_id`; use composite foreign keys/unique keys to enforce that child
project/inspection/evidence references belong to the same company. Include creator,
timestamps and immutable review/version references where relevant.

Define the role/action matrix before enabling writes. Suggested starting point:
company admins and HSE managers manage inspections and review; HSE officers and
supervisors submit evidence/findings; viewers read only. Exact creation, assignment,
review and closure permissions need a product decision, not a silent expansion of
existing project-admin privileges. Keep membership administration out of scope unless
explicitly designed. RLS enforces every action, with role/membership checked at query
time; migration tests cover each role and cross-company reference forgery.

Exit gate: migration forward/reset on local fixtures, independent-tenant negative
read/write/delete tests, owner browser inspection creation and persistence. Existing
project and membership permissions remain intact.

## 2. Private photo evidence pipeline

Create evidence metadata in a pending state after authorization. Generate canonical
keys such as `<organization>/<project>/<inspection>/<evidence-id>` from verified
records; bind object access to those records, not only an arbitrary path prefix.
Do not enable broad authenticated bucket writes. Prefer caller-scoped policies or
narrow upload grants; if privileged processing is necessary, explicitly review the
server-only secret and scope before configuring it securely.

Enforce per-file and per-tenant limits, supported byte signatures, dimensions and
pixel counts, count/rate quotas and protection against decompression/resource abuse.
Reject unsupported SVG/HTML and invalid/mismatched content. Use quarantine and safe
decode/re-encode before marking an image available for analysis. Remove EXIF/location
metadata by default; define consent/retention requirements before retaining originals.
Clean up abandoned uploads through an authorized, idempotent mechanism.

Use authenticated retrieval or short-lived scoped signed URLs. Keep objects private,
avoid public buckets and long-lived report links, and prevent listing, overwrite,
foreign key substitution and unauthorized deletion. Define retention, legal holds
and audit events before implementing deletion. Membership revocation cannot revoke
an already-issued signed URL immediately; lifetime and product wording must reflect
that limitation.

Exit gate: real development Storage API tests for anonymous/foreign/member reads,
new upload, oversized/invalid content, overwrite, delete, expired link, revoked
membership, orphan cleanup and cross-company paths. Test repeated/failing uploads
without leaving readable orphans. No actual workplace photos required for tests.

## 3. Preliminary hazard identification

Start with a deterministic adapter/stub and synthetic images. Introduce a real model
only after the owner selects a provider and approves development credentials, image
sharing, retention/residency and budget. Do not create a provider project implicitly.
Keep keys server-side and out of public variables. Authenticate jobs, recheck tenant
context when executing and writing results, and scope temporary image access.

Use an explicit analysis state machine: pending → processing → review_required,
with failed/cancelled/retry paths. Idempotency keys, bounded retries, concurrency and
cost limits prevent duplicate work and uncontrolled charges. Reuse existing hosting
capabilities where viable; assess execution limits before proposing a queue/service.

Return schema-validated observations with evidence references, visible uncertainty,
possible hazard/category, suggested severity and corrective guidance. Record model,
prompt/config version and provenance. Treat image text and notes as untrusted data;
they cannot issue instructions, invoke tools, select URLs or change authorization.
Avoid arbitrary outbound URL fetching. Do not fabricate measurements, regulations,
certainty or conditions outside the image. “No hazard detected” must not mean “safe.”

Exit gate: synthetic evaluation set, malformed-output and prompt-injection tests,
job isolation/retry tests and documented limitations. Model output remains a draft.

## 4. Mandatory human review and corrective actions

Show original validated evidence alongside proposed findings. An authorized human
must accept, edit or reject each finding and record rationale, severity and action
ownership/due date. Rejected/failed/unreviewed analysis cannot become an approved
report automatically. Define reviewer qualification and whether self-approval is
permitted before shipping; capture decisions explicitly.

Version findings/reviews and use concurrency controls so stale submissions cannot
overwrite reviewed decisions. Preserve provenance and audit review/approval/closure
transitions; do not allow client-authored audit events. Urgent concerns should prompt
qualified human escalation, not an automated claim of regulatory compliance or a
replacement for emergency/site procedures.

Exit gate: role-transition and stale-write tests, reviewer attribution, and an owner
walkthrough of accepted, edited, rejected and failed analyses. Closing an action
requires the agreed evidence/reviewer checks.

## 5. Reports and release checks

Produce tenant-scoped inspection reports with image references, reviewed findings,
corrective actions, reviewers, dates and report version. Clearly label drafts and
unreviewed content; approved reports retain the human review record. Build sanitized
HTML first, then controlled PDF export if required. Escape user/AI text and prevent
HTML/script injection, arbitrary URL fetching and cross-company image embedding.

Reports and downloads remain private. Audit generation/access as appropriate;
recheck authorization when issuing links. Avoid exporting signed storage URLs or
secrets into permanent PDFs. Specify report retention/versioning and revocation
behavior rather than adding public sharing by default.

Exit gate: cross-tenant generation/download denial, sanitized-output tests,
repeatable reports from reviewed snapshots, desktop/mobile inspection workflow,
accessibility checks, lint/typechecks/tests/build and protected staging acceptance.
The Phase 1.5 open dependency risk, provider configuration, quotas/abuse controls,
CSP and deployed API/security checks must be resolved or explicitly reviewed at the
appropriate release gate. No production release is part of this plan.

## Delivery order and completion evidence

Implement inspection schema/UI first, then the secured upload pipeline, stubbed
analysis, human review and reports. Only then connect a real approved model and
run evaluation. Keep each slice reviewable with migrations, meaningful permission
tests, failure handling and a clear PR summary.

For each milestone record the exact protected deployment SHA and distinguish local
SQL tests, stub/provider contract tests, real API tests and owner browser acceptance.
Use synthetic content and approved development accounts; never log passwords, session
cookies, confirmation links, photos or signed URLs. Carry forward the successful
Phase 1.5 owner results and rerun affected regressions when behavior changes.
