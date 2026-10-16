import Link from "next/link";
import { randomUUID } from "node:crypto";
import { InspectionNav } from "@/components/inspection-nav";
import { InspectionFields } from "@/components/inspection-form";
import { inspectionContext } from "@/lib/inspections/server";
import { canWrite } from "@/lib/inspections/validation";
import { createInspection } from "../actions";
export default async function New({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; project?: string; message?: string }>;
}) {
  const { org, project, message } = await searchParams;
  const { member, projects } = await inspectionContext(org);
  const allowed = canWrite(member.role);
  return (
    <>
      <InspectionNav org={member.organization_id} />
      <main className="inspection-main">
        <p className="eyebrow">INSPECTIONS / NEW RECORD</p>
        <h1>Create inspection</h1>
        {message && (
          <p role="alert" className="notice">
            {message}
          </p>
        )}
        {!allowed ? (
          <section className="card">
            <h2>Read-only access</h2>
            <p>Your role cannot create or edit inspections.</p>
          </section>
        ) : !projects.length ? (
          <section className="card">
            <h2>A project is required</h2>
            <p>Ask a company administrator to create a project first.</p>
            <Link href={`/dashboard?org=${member.organization_id}#projects`}>
              View projects
            </Link>
          </section>
        ) : (
          <form action={createInspection} className="card inspection-form">
            <input
              type="hidden"
              name="organization_id"
              value={member.organization_id}
            />
            <input type="hidden" name="request_id" value={randomUUID()} />
            <label>
              Project
              <select
                name="project_id"
                required
                defaultValue={
                  projects.some((p) => p.id === project)
                    ? project
                    : projects[0].id
                }
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <InspectionFields />
          </form>
        )}
        <p>
          <Link href={`/inspections?org=${member.organization_id}`}>
            Back to inspections
          </Link>
        </p>
      </main>
    </>
  );
}
