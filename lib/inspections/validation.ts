import { z } from "zod";
export const statuses = [
  "draft",
  "submitted",
  "under_review",
  "reviewed",
] as const;
export const inspectionFields = z.object({
  title: z.string().trim().min(2).max(160),
  work_area: z.string().trim().min(2).max(200),
  inspected_at: z.iso
    .datetime({ offset: true })
    .refine(
      (s) => s >= "2000" && s < "2100",
      "Use a date from 2000 through 2099.",
    ),
  inspector_name: z.string().trim().min(2).max(120),
  description: z.string().max(8000),
  observations: z.string().max(8000),
});
export const createInspectionInput = inspectionFields.extend({
  organization_id: z.uuid(),
  project_id: z.uuid(),
  request_id: z.uuid(),
});
export const editInspectionInput = inspectionFields.extend({
  id: z.uuid(),
  version: z.coerce.number().int().min(1).max(2147483647),
});
export const transitionInput = z
  .object({
    id: z.uuid(),
    version: z.coerce.number().int().min(1).max(2147483647),
    status: z.enum(["submitted", "under_review", "reviewed"]),
    review_note: z.string().trim().max(4000).default(""),
  })
  .refine(
    (v) => v.status !== "reviewed" || v.review_note.length >= 10,
    "Record at least 10 characters of human review notes.",
  );
export const inspectionFilters = z
  .object({
    q: z.string().trim().max(100).default(""),
    project: z.union([z.uuid(), z.literal("")]).default(""),
    status: z.union([z.enum(statuses), z.literal("")]).default(""),
    from: z.union([z.iso.date(), z.literal("")]).default(""),
    to: z.union([z.iso.date(), z.literal("")]).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "End date must not precede start date.",
  );
export function fieldValues(form: FormData) {
  const values = Object.fromEntries(form);
  // Forms explicitly label UTC; never interpret the deployment server's local zone.
  if (
    typeof values.inspected_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.inspected_at)
  )
    values.inspected_at += ":00Z";
  return values;
}
export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}
export function canWrite(role: string) {
  return ["company_admin", "hse_manager", "hse_officer", "supervisor"].includes(
    role,
  );
}
export function canReview(role: string) {
  return ["company_admin", "hse_manager"].includes(role);
}
