# Architecture

Next.js App Router + React + TypeScript deployed through Vercel. Native CSS provides
responsive navy/teal styling without a component framework. Server Actions validate
inputs with Zod and use the caller's Supabase session. Next.js checks Action origins;
no unprotected custom mutation APIs are exposed.

Supabase Auth owns passwords, email verification, recovery and session tokens.
`proxy.ts` refreshes cookies; every protected page/action independently calls
`auth.getUser()`. Authorization comes from database membership, never user metadata.
Cookies use the Supabase SSR defaults; they are not claimed to be HttpOnly. Never
share SSR Supabase clients across requests or cache tenant pages publicly.

PostgreSQL provides transactions, constraints, RLS and narrowly scoped definer RPCs.
The application uses only the public publishable key plus the user session.
A private Storage bucket is provisioned for future evidence, with tenant-scoped
reads and no browser write policy. No public or signed URL endpoint exists yet.

Organization switching validates the requested ID against the caller's memberships.
Project creation accepts an organization ID, then RLS verifies admin membership.
Dashboard counts derive from returned projects, not fabricated inspection activity.

Future services (AI jobs, evidence validation, billing, reports) are deliberately
absent until their own security and persistence milestones.
