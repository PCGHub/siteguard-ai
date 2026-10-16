import Link from "next/link";
import { InspectionNav } from "@/components/inspection-nav";
import { inspectionContext } from "@/lib/inspections/server";
import {
  inspectionFilters,
  statuses,
  statusLabel,
  canWrite,
} from "@/lib/inspections/validation";
export default async function List({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { db, member, projects, members } = await inspectionContext(params.org);
  const parsed = inspectionFilters.safeParse(params);
  const filters = parsed.success ? parsed.data : inspectionFilters.parse({});
  let query = db
    .from("inspections")
    .select(
      "id,title,project_id,work_area,inspected_at,status,inspector_name",
      { count: "exact" },
    )
    .eq("organization_id", member.organization_id);
  if (filters.q)
    query = query.ilike("title", `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (filters.project) query = query.eq("project_id", filters.project);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from)
    query = query.gte("inspected_at", `${filters.from}T00:00:00Z`);
  if (filters.to)
    query = query.lt(
      "inspected_at",
      new Date(Date.parse(`${filters.to}T00:00:00Z`) + 86400000).toISOString(),
    );
  const {
    data: records,
    error,
    count,
  } = await query
    .order("inspected_at", { ascending: false })
    .order("id")
    .range((filters.page - 1) * 20, filters.page * 20 - 1);
  if (error)
    throw new Error(
      "Inspections unavailable. Check the development migration.",
    );
  function pageLink(page: number) {
    return `/inspections?${new URLSearchParams({ org: member.organization_id, ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)])), page: String(page) })}`;
  }
  return (
    <>
      <InspectionNav org={member.organization_id} />
      <main className="inspection-main">
        <header className="dash-header">
          <div>
            <p className="eyebrow">COMPANY WORKSPACE</p>
            <h1>Inspections</h1>
            <p>Record site observations. Keep each review traceable.</p>
          </div>
          {canWrite(member.role) && (
            <Link
              className="button"
              href={`/inspections/new?org=${member.organization_id}`}
            >
              Create inspection
            </Link>
          )}
        </header>
        <nav className="org-switch" aria-label="Company selector">
          {members.map((m) => (
            <Link
              key={m.organization_id}
              href={`/inspections?org=${m.organization_id}`}
              aria-current={
                m.organization_id === member.organization_id
                  ? "page"
                  : undefined
              }
            >
              {(m.organizations as unknown as { name: string }).name}
            </Link>
          ))}
        </nav>
        {params.message && (
          <p role="status" className="notice">
            {params.message}
          </p>
        )}
        {!parsed.success && (
          <p role="alert" className="notice">
            Invalid filters. Showing the first page; check dates and selections.
          </p>
        )}
        <form method="get" className="card inspection-filters">
          <input type="hidden" name="org" value={member.organization_id} />
          <label>
            Search title
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters.q}
            />
          </label>
          <label>
            Project
            <select name="project" defaultValue={filters.project}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            From date (UTC)
            <input type="date" name="from" defaultValue={filters.from} />
          </label>
          <label>
            To date (UTC)
            <input type="date" name="to" defaultValue={filters.to} />
          </label>
          <button>Apply filters</button>
          <Link href={`/inspections?org=${member.organization_id}`}>
            Clear filters
          </Link>
        </form>
        <p role="status">
          {count ?? 0} matching inspections · Page {filters.page}
        </p>
        <section className="project-list" aria-label="Inspection records">
          {records?.length ? (
            records.map((r) => (
              <article key={r.id} className="card">
                <span className="badge">{statusLabel(r.status)}</span>
                <h2>
                  <Link href={`/inspections/${r.id}`}>{r.title}</Link>
                </h2>
                <p>
                  {projects.find((p) => p.id === r.project_id)?.name} ·{" "}
                  {r.work_area}
                </p>
                <p>
                  {new Date(r.inspected_at)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 16)}{" "}
                  UTC · {r.inspector_name}
                </p>
              </article>
            ))
          ) : (
            <article className="card empty">
              <h2>No matching inspections</h2>
              <p>
                {canWrite(member.role)
                  ? "Create a draft for an existing project, or adjust your filters."
                  : "Adjust your filters or ask your inspection team to create a record. Your role has read-only access."}
              </p>
            </article>
          )}
        </section>
        <nav className="inspection-pagination" aria-label="Inspection pages">
          {filters.page > 1 && (
            <Link href={pageLink(filters.page - 1)}>Previous page</Link>
          )}
          {filters.page * 20 < (count ?? 0) && (
            <Link href={pageLink(filters.page + 1)}>Next page</Link>
          )}
        </nav>
      </main>
    </>
  );
}
