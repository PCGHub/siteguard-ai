import Link from "next/link";
import { Submit } from "./submit";
import { logout } from "@/app/actions";
import { configured } from "@/lib/supabase/server";
export function AuthForm({
  title,
  description,
  action,
  mode,
  message,
}: {
  title: string;
  description: string;
  action: (form: FormData) => Promise<void>;
  mode: string;
  message?: string;
}) {
  return (
    <main className="auth">
      <Link className="brand" href="/">
        ◈ SiteGuard AI
      </Link>
      <section className="card">
        <p className="eyebrow">YOUR SAFETY WORKSPACE</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {!configured() ? (
          <p role="alert" className="notice">
            Supabase configuration is required. See README.md to connect a
            development project. Set APP_ORIGIN to the exact application origin
            as described there.
          </p>
        ) : (
          <form action={action}>
            {mode !== "reset" && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode !== "forgot" && mode !== "resend" && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
              </label>
            )}
            <Submit>{title}</Submit>
          </form>
        )}
        {mode === "reset" && configured() && (
          <form action={logout}>
            <Submit>Sign out</Submit>
          </form>
        )}
        <nav className="auth-links">
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Create account</Link>
          <Link href="/forgot-password">Reset password</Link>
          <Link href="/resend-confirmation">Resend confirmation</Link>
        </nav>
      </section>
    </main>
  );
}
