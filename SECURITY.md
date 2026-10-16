# Security model and limitations

Never commit `.env.local`, credentials, session tokens, real workplace images or
service-role keys. This milestone needs only a project URL and public publishable key.
No production credentials have been used. Configure secrets through provider settings.

RLS is the tenant boundary. Every database operation uses the caller's session;
privileged service-role bypasses are absent. Database roles are authoritative.
No client operation can change memberships or read other-company projects.
Administrative creation events are logged without including sensitive payloads.

Auth requires verified email in the provider configuration. Supabase rate limits
cover auth endpoints. Tenant creation/project creation have no application-specific
quotas yet: assess signup abuse, CAPTCHA, company limits and billing entitlements
before opening public registration. Invitations, MFA UI, support access, deletion,
retention, monitoring, backup recovery drills and comprehensive audit trails remain
future work. No commercial security certification or regulatory compliance is claimed.

Session cookies are HttpOnly, SameSite=Lax, and Secure in production. Auth token refresh stays on the server. Apply CSP/XSS hardening and deployment security
review before production. Basic anti-framing, no-referrer and nosniff headers are set.
Error pages avoid returning database error detail. Public messages are React-escaped.
Email links restrict their token type and post-auth destination; no arbitrary redirect
is accepted. Configure exact owned Auth URLs; default email templates and optional
token-hash templates are supported.

Private evidence reads are scoped by the organization path; uploads and downloads
through the application are not implemented. No real photographs were used in tests.
AI processing is not implemented; no assessments or safety certifications are fabricated.

Report vulnerabilities privately to the repository owner; do not include credentials
or private customer data in public issues.

Authentication redirects require an explicit APP_ORIGIN. Request Host and forwarded
headers do not supply redirect authority. Default email links use PKCE code exchange
bound to the requesting browser's HttpOnly verifier cookie. Recovery intent comes
from the SDK verifier marker, not a query parameter. Missing/mismatched verifiers,
provider errors and ambiguous credentials fail closed. Optional token-hash links
retain distinct signup/recovery types. Both flows redirect only to fixed local
paths and never echo provider error details or tokens. Legacy implicit fragment
sessions are not accepted; request fresh links from this app.
Provider success/error responses and cookie handling are covered by stub-contract tests.
Owner-reported live Phase 1.5 successes are recorded in docs/PHASE_1_5_SIGN_OFF.md;
direct hosted API and Storage security checks remain separate release gates.

Inspection records use member-only RLS reads and RPC-only mutations, composite
company/project foreign keys, mandatory optimistic versions and database-generated
audit identities. Only authors with writing roles edit/submit their drafts; another
company admin/HSE manager must review, with no self-review or automatic safety
approval. New inspection RLS/RPC behavior has been tested in embedded PostgreSQL;
hosted API enforcement remains unverified. See docs/INSPECTION_MANAGEMENT.md.
