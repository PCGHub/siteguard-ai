"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inspectionSession } from "@/lib/inspections/server";
import {
  createInspectionInput,
  editInspectionInput,
  fieldValues,
  transitionInput,
} from "@/lib/inspections/validation";
function fail(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}
function problem(error: { code?: string }) {
  return error.code === "40001"
    ? "This inspection changed. Reload before retrying; your changes were not saved."
    : "Unable to save. Check your permissions, project and fields, then reload before retrying.";
}
export async function createInspection(form: FormData) {
  const parsed = createInspectionInput.safeParse(fieldValues(form));
  const org = z.uuid().safeParse(form.get("organization_id"));
  const path = `/inspections/new${org.success ? `?org=${org.data}` : ""}`;
  if (!parsed.success)
    redirect(
      `${path}${org.success ? "&" : "?"}message=Check+all+fields.+Use+valid+IDs,+UTC+date,+and+the+displayed+text+limits.`,
    );
  const { db } = await inspectionSession();
  const { data, error } = await db.rpc(
    "create_inspection",
    Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [`p_${k}`, v]),
    ),
  );
  if (error || !z.uuid().safeParse(data).success)
    redirect(
      `${path}${org.success ? "&" : "?"}message=Unable+to+create.+Check+your+permissions,+project+and+fields.`,
    );
  revalidatePath("/inspections");
  redirect(`/inspections/${data}`);
}
export async function editInspection(form: FormData) {
  const parsed = editInspectionInput.safeParse(fieldValues(form));
  if (!parsed.success)
    fail(
      "/inspections",
      "Invalid draft fields. Reopen the inspection and check the required fields and text limits.",
    );
  const { db } = await inspectionSession();
  const { error } = await db.rpc(
    "update_inspection_draft",
    Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [`p_${k}`, v]),
    ),
  );
  if (error) fail(`/inspections/${parsed.data.id}/edit`, problem(error));
  revalidatePath("/inspections");
  revalidatePath(`/inspections/${parsed.data.id}`);
  redirect(`/inspections/${parsed.data.id}?message=Draft+saved.`);
}
export async function transitionInspection(form: FormData) {
  const parsed = transitionInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    fail(
      "/inspections",
      "Invalid transition or missing human review notes. Reopen the inspection.",
    );
  const { db } = await inspectionSession();
  const { error } = await db.rpc("transition_inspection", {
    p_id: parsed.data.id,
    p_version: parsed.data.version,
    p_status: parsed.data.status,
    p_review_note: parsed.data.review_note,
  });
  if (error) fail(`/inspections/${parsed.data.id}`, problem(error));
  revalidatePath("/inspections");
  revalidatePath(`/inspections/${parsed.data.id}`);
  redirect(`/inspections/${parsed.data.id}?message=Status+updated.`);
}
