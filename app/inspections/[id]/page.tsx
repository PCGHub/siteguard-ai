import Link from "next/link";
import { InspectionNav } from "@/components/inspection-nav";
import { Submit } from "@/components/submit";
import { inspectionRecord } from "@/lib/inspections/server";
import { canWrite, canReview, statusLabel } from "@/lib/inspections/validation";
import { transitionInspection } from "../actions";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { db, user, record: r, role } = await inspectionRecord(id);
  const { message } = await searchParams;
  const { data: history, error } = await db
    .from("inspection_history")
    .select("id,actor_id,event,from_status,to_status,version,created_at")
    .eq("inspection_id", id)
    .order("version", { ascending: false })
    .limit(200);
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("name")
    .eq("id", r.project_id)
    .eq("organization_id", r.organization_id)
    .maybeSingle();
  if (error || projectError) throw new Error("Inspection history unavailable.");
  const ownDraft =
    r.status === "draft" && r.created_by === user.id && canWrite(role);
  const startReview =
    r.status === "submitted" && r.created_by !== user.id && canReview(role);
  const finishReview =
    r.status === "under_review" && r.reviewer_id === user.id && canReview(role);
  return (
    <>
      <InspectionNav org={r.organization_id} />
      <main className="inspection-main">
        <p className="eyebrow">INSPECTION RECORD</p>
        <header className="dash-header">
          <div>
            <h1>{r.title}</h1>
            <p>
              {project?.name} · {r.work_area}
            </p>
          </div>
          <span className="badge">{statusLabel(r.status)}</span>
        </header>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <section className="card inspection-copy">
          <h2>Site record</h2>
          <dl>
            <dt>Inspection time (UTC)</dt>
            <dd>{new Date(r.inspected_at).toISOString()}</dd>
            <dt>Inspector display name</dt>
            <dd>{r.inspector_name}</dd>
            <dt>Recorded by (account ID)</dt>
            <dd>{r.created_by}</dd>
            <dt>Version</dt>
            <dd>{r.version}</dd>
            <dt>Last updated (UTC)</dt>
            <dd>{new Date(r.updated_at).toISOString()}</dd>
          </dl>
          <h3>Description</h3>
          <p className="preserve-text">
            {r.description || "No description recorded."}
          </p>
          <h3>Observations</h3>
          <p className="preserve-text">
            {r.observations || "No observations recorded."}
          </p>
        </section>
        <section className="card">
          <h2>Workflow</h2>
          <p>
            Reviewed records document a human review. They do not certify that a
            site is safe or approve corrective actions.
          </p>
          {ownDraft && (
            <>
              <Link
                className="button secondary"
                href={`/inspections/${id}/edit`}
              >
                Edit draft
              </Link>
              <p>
                Submission locks the draft fields. Check your observations
                before submitting.
              </p>
            </>
          )}
          {ownDraft || startReview || finishReview ? (
            <form action={transitionInspection}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="version" value={r.version} />
              <input
                type="hidden"
                name="status"
                value={
                  ownDraft
                    ? "submitted"
                    : startReview
                      ? "under_review"
                      : "reviewed"
                }
              />
              {finishReview && (
                <label>
                  Human review notes
                  <textarea
                    name="review_note"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={5}
                  />
                </label>
              )}
              <Submit>
                {ownDraft
                  ? "Submit for review"
                  : startReview
                    ? "Begin review"
                    : "Mark reviewed"}
              </Submit>
            </form>
          ) : (
            <p>
              No workflow action is available to your role on this record.
              Reviews require another company admin or HSE manager; drafts are
              editable only by their author.
            </p>
          )}
          {r.review_note && (
            <>
              <h3>Human review notes</h3>
              <p className="preserve-text">{r.review_note}</p>
              <p>Reviewer account: {r.reviewer_id}</p>
            </>
          )}
        </section>
        <section className="card">
          <h2>Status and history</h2>
          <p>
            Most recent 200 events, newest first. Account attribution is
            recorded by the database.
          </p>
          <ol className="inspection-history">
            {history?.map((h) => (
              <li key={h.id}>
                <strong>
                  {statusLabel(h.event)} · version {h.version}
                </strong>
                <p>
                  {h.from_status ? `${statusLabel(h.from_status)} → ` : ""}
                  {statusLabel(h.to_status)} ·{" "}
                  {new Date(h.created_at).toISOString()}
                </p>
                <small>
                  Actor: {h.actor_id === user.id ? "You" : h.actor_id}
                </small>
              </li>
            ))}
          </ol>
        </section>
        <p>
          <Link href={`/inspections?org=${r.organization_id}`}>
            Back to company inspections
          </Link>
        </p>
      </main>
    </>
  );
}
