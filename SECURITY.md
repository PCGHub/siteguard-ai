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
is accepted. Configure exact owned Auth URLs and correct token-hash email templates.

Private evidence reads are scoped by the organization path; uploads and downloads
through the application are not implemented. No real photographs were used in tests.
AI processing is not implemented; no assessments or safety certifications are fabricated.

Report vulnerabilities privately to the repository owner; do not include credentials
or private customer data in public issues.

Authentication redirects require an explicit APP_ORIGIN. Request Host and forwarded
headers do not supply redirect authority. Confirmations and recovery use token hashes
with distinct allowed types; default PKCE code links are rejected with recovery guidance.
Provider success/error responses and cookie handling are covered by stub-contract tests,
but real staging email/session verification is still required before Phase 2.
