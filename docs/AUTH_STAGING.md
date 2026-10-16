# Phase 1.5: development email authentication

> The owner has now reported successful live confirmation/login, recovery/reset,
> session persistence, logout and company/project isolation. See the
> [acceptance review](PHASE_1_5_SIGN_OFF.md). The checklist below defines coverage;
> it does not mean those owner-demonstrated flows remain untested. Hosted API and
> Storage security verification remain separate outstanding checks.

## Supported default-template flow

Use the existing Supabase development project `qaguumtcsshopfeyflrp` and protected
Vercel project `siteguard-ai-dev`. No new project, domain or SMTP service is needed
for limited development acceptance with authorized recipients.

Keep Supabase's built-in Confirm signup and Reset password templates, which link
through `{{ .ConfirmationURL }}`. The app's server Supabase client uses PKCE:

1. Signup, confirmation resend or recovery creates a verifier stored in an HttpOnly,
   SameSite=Lax cookie (Secure on HTTPS production builds) and sends its challenge
   and explicit `<APP_ORIGIN>/auth/confirm` redirect to Supabase.
2. The default email links to Supabase's verification endpoint. Supabase verifies
   the email token and redirects the browser to `/auth/confirm?code=…`.
3. The callback exchanges that one-time code using the browser's verifier cookie.
   The SDK's stored recovery marker selects `/reset-password`; signup/resend goes
   to the clean login success screen. Query `next`, `redirect_to` or `type` cannot
   change the PKCE destination. Signup confirmation establishes a session; password
   login is offered explicitly and is not an additional authorization gate.
4. Protected routes verify users with `getUser`. Password reset requires a verified
   session, updates the password and signs out. Failed sign-out is reported honestly
   with a retry control. Logout and ordinary login retain the server-cookie design.

Open the **latest email in the same browser/profile on the same stable origin**
that requested it. Private windows, another device, cleared cookies or requests from
another origin do not have the verifier and fail safely. With the SDK's default
single active verifier, a newer email request can supersede an earlier request;
complete one flow at a time. Request a fresh email from the intended browser if
necessary. Old codes and implicit `#access_token=…` links are not portable sessions;
we do not add a client-side fragment-token importer or weaken HttpOnly cookies.

`/auth/callback` shares the same implementation for compatibility. A root `?code`
redirects to the verifier callback. Missing, expired, reused, mismatched, ambiguous
or provider-error links return generic guidance without echoing credentials.
All callback destinations are fixed relative paths; responses set private/no-store
and no-referrer. APP_ORIGIN remains an operator-configured exact HTTPS origin,
never derived from request headers. Explicit local HTTP loopback remains supported.

## Optional token-hash compatibility

The existing `supabase/templates/confirmation.html` and `recovery.html` still work
where custom templates are available. They use `.RedirectTo`, `.TokenHash` and
`type=signup` / `type=recovery`, verified with `verifyOtp`. They are **optional**;
do not purchase SMTP or change templates to run default-template acceptance.
The local Supabase config now uses built-in templates too, so the guarded local
Mailpit browser journey will exercise PKCE when a full local stack is available.

## Exact development settings

Owner-reported stable staging origin:

`https://siteguard-ai-dev-git-dev-foundation-pcgrowthhub-2263s-projects.vercel.app`

Verify a protected READY deployment containing this default-email repair and record
its full SHA before acceptance. Previously verified `ea487c5` predates this repair.
No production deploy, protection disablement or merge into main is authorized.

Vercel Preview settings must contain:

- `APP_ORIGIN`: exact stable HTTPS origin, no trailing slash.
- `NEXT_PUBLIC_SUPABASE_URL`: `https://qaguumtcsshopfeyflrp.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public key of that development project.

In that Supabase project's Auth settings:

- Site URL: exact stable origin.
- Allowed redirect: exactly `<stable-origin>/auth/confirm`, with no wildcard.
- Keep the default confirmation and password-recovery templates.
- Keep email confirmations enabled and the 12-character password minimum.

The owner reports Site URL and redirect configured. They have **not** been independently
read here. Changing a template or supplying management credentials is unnecessary
for default-template browser acceptance. Rebuild the Preview to apply code/variable
changes. Keep existing Vercel authentication protection enabled and sign into it in
the testing browser before requesting email. For automated protected access use the
existing automation-bypass mechanism via secure settings, never disable protection.

## Built-in email limitations

Supabase's [official SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)
currently states that without custom SMTP, email is sent **only to addresses on the
Supabase project's organization team**, with a **two-messages-per-hour** quota that
can change, best-effort delivery and no SLA. Exact operational limits must be checked
in the development dashboard. App signup alone does not authorize a recipient for
built-in delivery. Arbitrary external customer emails and unrecognized plus-address
aliases will not work merely because the application supports the default template.
Do not grant infrastructure team access casually just to authorize a test inbox;
prefer an existing team member's exact address. This app's users/organizations and
Supabase infrastructure team membership are separate concepts.

Plan a fresh-account confirmation and one recovery email within the quota; avoid
unnecessary resend attempts. If the existing team address already has an app account,
use recovery/login or an approved existing team tester with no app account for signup.
Do not delete accounts or bypass email verification just to force a test to pass.
Check spam folders and avoid email scanners consuming one-time links. A successful
request does not prove delivery; the app reports provider failures generically.
Public/commercial registration will eventually need a production email delivery
solution. The no-SMTP path is sufficient only for limited authorized development tests.

## Verification and remaining live gate

Automated SDK contract tests use the real Supabase SDK against a stub provider that
checks the PKCE challenge/verifier pairing. They cover signup/resend/recovery code
exchange, recovery marker routing, secure cookies, password update/logout/login,
missing/mismatched verifiers, expired/reused codes, input errors and external redirect
attempts, plus retained token-hash success/replay/type checks. They are not evidence
of real Supabase email delivery or hosted session behavior.

After deploying this repair, an authorized tester must still record:

1. READY/full SHA/stable alias/protection and exact development Auth configuration.
2. Fresh signup from the app, actual default email receipt, confirmation in the same
   browser, clean success URL and explicit password login.
3. Organization creation, project creation, dashboard refresh, logout, anonymous
   dashboard denial and subsequent login.
4. Actual default recovery email receipt, same-browser reset screen, password update,
   logout, new password login and old password rejection.
5. Reused/expired links fail without a fresh session; opening a code without its
   verifier fails safely and gives guidance. Use fresh flows if a scanner consumed it.
6. Two real tenants' API isolation and private Storage access checks, as required
   by the final audit. The app still has no evidence upload UI.

`npm run staging:check` is read-only and accepts default ConfirmationURL or optional
token-hash template metadata. Explicit empty template bodies represent provider
built-in defaults; missing metadata does not pass. This cannot prove actual email
content or delivery. It requires securely configured `VERCEL_TOKEN`,
`SUPABASE_ACCESS_TOKEN` and `APP_ORIGIN`; management access is optional if the owner
checks settings directly. Do not paste tokens, passwords or confirmation links in
chat. See [operator handoff](STAGING_OPERATOR_HANDOFF.md) and the
[historical final audit](PHASE_1_5_FINAL_AUDIT.md) for other outstanding security gates.
