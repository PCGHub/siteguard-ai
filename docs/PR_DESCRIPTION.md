# Add secure multi-tenant SiteGuard AI foundation

The repository previously contained only a product description. This branch adds a
Next.js application with Supabase email authentication, company onboarding, project
creation and a responsive company dashboard. All workspace data comes from the
caller's authorized Supabase queries; unconfigured instances show setup guidance.

The migration adds organizations, memberships, projects and creation audit events,
RLS policies, a transactional onboarding RPC and a private evidence bucket. Client
role/membership mutation and evidence writes remain denied. Inspection/AI/billing
workflows and invitations are explicitly deferred.

Validation: lint, typecheck, production build, 24 unit/PostgreSQL tests and six desktop/mobile public browser tests passed. Full local Auth acceptance is blocked by Docker vfs exhausting the 32 GB disk; no hosted credentials were available. See docs/VALIDATION.md for exact results and limitations. Hosted Supabase
and Vercel configuration require owner selection/approval; no production credentials,
remote migrations or production deployment are included.

## Phase 1.5 authentication repair

Signup and recovery previously relied on the provider's default redirect, allowing
staging email links to return to localhost with a PKCE code that the app did not
exchange. Authentication now requires explicit APP_ORIGIN and uses matching
RedirectTo/token-hash templates plus verifyOtp. Confirmation shows a clear success
message before password login; expired/retired links provide resend guidance.

Validation: lint, TypeScript, production build, 46 unit/PostgreSQL/SDK-contract tests
and 12 desktop/mobile public browser tests passed. The SDK provider is stubbed.
Real staging email delivery, account-to-dashboard persistence, recovery and Vercel
READY status are blocked by provider/network access and are not claimed as verified.
Both existing migrations are preserved and included in database security tests.
See docs/AUTH_STAGING.md for exact staging settings and the acceptance gate. Phase 2
remains blocked until the real journey passes. No production deployment or merge.
