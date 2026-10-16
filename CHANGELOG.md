# Changelog

## 0.1.0

- Initialized Next.js/React/TypeScript application and responsive SiteGuard AI shell.
- Added Supabase SSR auth, signup confirmation, login/logout and password recovery.
- Added transactional company creation, organization selection and admin project creation.
- Added organization/member/project/audit migration, tenant RLS and private evidence bucket.
- Added input and PostgreSQL authorization tests, desktop/mobile browser checks and CI.
- Documented development configuration, security limits and Vercel deployment steps.

## Phase 1.5

- Require a trusted APP_ORIGIN for signup, recovery and confirmation resend.
- Align email templates and callback on token-hash verification; show verification success before password login.
- Add confirmation resend and safe handling of retired PKCE links without exchanging or reflecting codes.
- Test the real Supabase SDK against a stub provider; apply both database migrations and verify definer privileges.
- Document exact staging settings and the live-auth acceptance gate.
