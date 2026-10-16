import Link from "next/link";
import { InspectionNav } from "@/components/inspection-nav";
import { InspectionFields } from "@/components/inspection-form";
import { inspectionRecord } from "@/lib/inspections/server";
import { canWrite } from "@/lib/inspections/validation";
import { editInspection } from "../../actions";
export default async function Edit({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { record, user, role } = await inspectionRecord(id);
  const { message } = await searchParams;
  const allowed =
    record.status === "draft" &&
    record.created_by === user.id &&
    canWrite(role);
  return (
    <>
      <InspectionNav org={record.organization_id} />
      <main className="inspection-main">
        <h1>Edit draft inspection</h1>
        {message && (
          <p role="alert" className="notice">
            {message}
          </p>
        )}
        {allowed ? (
          <form action={editInspection} className="card inspection-form">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="version" value={record.version} />
            <p>
              Project and author are fixed. Version {record.version}; stale
              changes will be rejected.
            </p>
            <InspectionFields values={record} />
          </form>
        ) : (
          <section className="card">
            <h2>Editing unavailable</h2>
            <p>
              Only the author with a writing role can edit a draft. Submitted
              records are locked.
            </p>
          </section>
        )}
        <p>
          <Link href={`/inspections/${id}`}>Back to inspection</Link>
        </p>
      </main>
    </>
  );
}
