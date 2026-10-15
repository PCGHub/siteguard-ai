"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth">
      <section className="card">
        <h1>We couldn’t load your workspace</h1>
        <p>
          Please try again. If this continues, ask your administrator to check
          the Supabase configuration and migrations.
        </p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
