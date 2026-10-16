import Link from "next/link";
export default function NotFound() {
  return (
    <main className="inspection-main">
      <section className="card">
        <h1>Inspection unavailable</h1>
        <p>
          This record does not exist or your company membership does not permit
          access.
        </p>
        <Link href="/inspections">Return to inspections</Link>
      </section>
    </main>
  );
}
