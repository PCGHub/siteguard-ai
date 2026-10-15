# Add secure multi-tenant SiteGuard AI foundation

The repository previously contained only a product description. This branch adds a
Next.js application with Supabase email authentication, company onboarding, project
creation and a responsive company dashboard. All workspace data comes from the
caller's authorized Supabase queries; unconfigured instances show setup guidance.

The migration adds organizations, memberships, projects and creation audit events,
RLS policies, a transactional onboarding RPC and a private evidence bucket. Client
role/membership mutation and evidence writes remain denied. Inspection/AI/billing
workflows and invitations are explicitly deferred.

Validation: see docs/VALIDATION.md for exact results and limitations. Hosted Supabase
and Vercel configuration require owner selection/approval; no production credentials,
remote migrations or production deployment are included.
