import Link from "next/link";
import { redirect } from "next/navigation";
import { configured, supabase } from "@/lib/supabase/server";
import { createProject, logout } from "@/app/actions";
import { Submit } from "@/components/submit";
export const dynamic = "force-dynamic";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; message?: string }>;
}) {
  if (!configured()) redirect("/login");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: members, error: memberError } = await db
    .from("organization_members")
    .select("organization_id,role,organizations(id,name)")
    .eq("user_id", user.id);
  if (memberError)
    throw new Error(
      "Workspace data unavailable. Check database migrations and connection.",
    );
  if (!members?.length) redirect("/onboarding");
  const { org, message } = await searchParams;
  const selected = members.find((m) => m.organization_id === org) ?? members[0];
  const organization = selected.organizations as unknown as {
    id: string;
    name: string;
  };
  const {
    data: projects,
    error,
    count,
  } = await db
    .from("projects")
    .select("id,name,location,industry,created_at", { count: "exact" })
    .eq("organization_id", selected.organization_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Project data unavailable. Please retry.");
  return (
    <div className="workspace">
      <aside>
        <Link className="brand" href="/dashboard">
          ◈ SiteGuard AI
        </Link>
        <p className="eyebrow">WORKSPACE</p>
        <Link className="nav-active" href="/dashboard">
          Overview
        </Link>
        <a href="#projects">Projects</a>
        <Link href={`/inspections?org=${selected.organization_id}`}>
          Inspections
        </Link>
        <Link href="/onboarding">+ New company</Link>
        <div className="aside-bottom">
          <p>{user.email}</p>
          <form action={logout}>
            <button className="secondary">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="dashboard">
        <header className="dash-header">
          <div>
            <p className="eyebrow">COMPANY OVERVIEW</p>
            <h1>{organization.name}</h1>
            <p>Your people. Your projects. A stronger safety foundation.</p>
          </div>
          <span className="badge">{selected.role.replaceAll("_", " ")}</span>
        </header>
        <nav className="org-switch" aria-label="Company selector">
          {members.map((m) => (
            <Link
              key={m.organization_id}
              href={`/dashboard?org=${m.organization_id}`}
              aria-current={
                m.organization_id === selected.organization_id
                  ? "page"
                  : undefined
              }
            >
              {(m.organizations as unknown as { name: string }).name}
            </Link>
          ))}
        </nav>
        {message && (
          <p className="notice" role="alert">
            {message}
          </p>
        )}
        <section className="stats">
          <article className="card">
            <p>Company projects</p>
            <strong>{count ?? 0}</strong>
            <small>From your workspace</small>
          </article>
          <article className="card">
            <p>Your access</p>
            <strong className="stat-text">
              {selected.role.replaceAll("_", " ")}
            </strong>
            <small>Enforced by database policies</small>
          </article>
          <article className="card">
            <p>Site records</p>
            <strong className="stat-text">Inspections</strong>
            <Link href={`/inspections?org=${selected.organization_id}`}>
              View inspections →
            </Link>
          </article>
        </section>
        <section id="projects" className="project-layout">
          <div>
            <p className="eyebrow">BUILD YOUR SAFETY WORKSPACE</p>
            <h2>Projects</h2>
            {projects?.length ? (
              <div className="project-list">
                {projects.map((p) => (
                  <article className="card" key={p.id}>
                    <span className="badge">{p.industry}</span>
                    <h3>{p.name}</h3>
                    <p>{p.location || "Location not specified"}</p>
                    <p>
                      <Link
                        href={`/inspections?org=${selected.organization_id}&project=${p.id}`}
                      >
                        Project inspections →
                      </Link>
                    </p>
                    <small>
                      Created{" "}
                      {new Date(p.created_at).toLocaleDateString("en-GB", {
                        timeZone: "UTC",
                      })}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="card empty">
                <h3>Your first project starts here</h3>
                <p>Add a site or facility to organize your company’s work.</p>
              </div>
            )}
          </div>
          {selected.role === "company_admin" && (
            <section className="card">
              <h2>Create project</h2>
              <form action={createProject}>
                <input
                  type="hidden"
                  name="organization_id"
                  value={selected.organization_id}
                />
                <label>
                  Project name
                  <input name="name" required minLength={2} maxLength={120} />
                </label>
                <label>
                  Site / location
                  <input name="location" maxLength={200} />
                </label>
                <label>
                  Industry
                  <select name="industry">
                    {[
                      "Construction",
                      "Oil & Gas",
                      "Manufacturing",
                      "Industrial maintenance",
                    ].map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </select>
                </label>
                <Submit>Create project →</Submit>
              </form>
            </section>
          )}
        </section>
        <p className="footnote">
          Inspection records are available. Photo evidence and AI analysis
          remain planned; reviewed records do not certify site safety.
        </p>
      </main>
    </div>
  );
}
