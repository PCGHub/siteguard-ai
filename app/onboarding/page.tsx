export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { supabase, configured } from "@/lib/supabase/server";
import { createOrganization, logout } from "@/app/actions";
import { Submit } from "@/components/submit";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!configured()) redirect("/login");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { message } = await searchParams;
  return (
    <main className="auth">
      <section className="card">
        <p className="eyebrow">WELCOME TO SITEGUARD AI</p>
        <h1>Create your company workspace</h1>
        <p>
          You will become the administrator of this new organization. Existing
          companies remain private.
        </p>
        {message && (
          <p role="alert" className="notice">
            {message}
          </p>
        )}
        <form action={createOrganization}>
          <label>
            Company name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="organization"
            />
          </label>
          <Submit>Create workspace →</Submit>
        </form>
        <form action={logout}>
          <button className="secondary">Sign out</button>
        </form>
      </section>
    </main>
  );
}
