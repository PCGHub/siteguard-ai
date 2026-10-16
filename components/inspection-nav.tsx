import Link from "next/link";
import { logout } from "@/app/actions";
export function InspectionNav({ org }: { org?: string }) {
  const query = org ? `?org=${org}` : "";
  return (
    <nav className="inspection-nav" aria-label="Workspace navigation">
      <Link className="brand" href={`/dashboard${query}`}>
        ◈ SiteGuard AI
      </Link>
      <Link href={`/dashboard${query}`}>Dashboard</Link>
      <Link href={`/dashboard${query}#projects`}>Projects</Link>
      <Link href={`/inspections${query}`}>Inspections</Link>
      <form action={logout}>
        <button className="secondary">Sign out</button>
      </form>
    </nav>
  );
}
