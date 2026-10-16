import { describe, it, expect } from "vitest";
import {
  createInspectionInput,
  editInspectionInput,
  transitionInput,
  inspectionFilters,
  fieldValues,
} from "../lib/inspections/validation";
const valid = {
  organization_id: "10000000-0000-4000-8000-000000000001",
  project_id: "10000000-0000-4000-8000-000000000002",
  request_id: "10000000-0000-4000-8000-000000000003",
  title: "Platform inspection",
  work_area: "Platform A",
  inspected_at: "2026-10-16T12:30:00Z",
  inspector_name: "Test Inspector",
  description: "",
  observations: "",
};
describe("inspection validation", () => {
  it("accepts valid input and interprets form time explicitly as UTC", () => {
    const form = new FormData();
    for (const [k, v] of Object.entries(valid)) form.set(k, v);
    form.set("inspected_at", "2026-10-16T12:30");
    expect(createInspectionInput.parse(fieldValues(form))).toEqual(valid);
  });
  it.each([
    { title: "" },
    { project_id: "other" },
    { organization_id: "" },
    { request_id: "" },
    { inspected_at: "2026-02-30T12:00:00Z" },
    { inspected_at: "2026-10-16T12:00" },
    { inspected_at: "2100-01-01T00:00:00Z" },
    { description: "x".repeat(8001) },
    { observations: new Blob(["bad"]) },
  ])("rejects malformed inspection input (%#)", (changes) => {
    expect(
      createInspectionInput.safeParse({ ...valid, ...changes }).success,
    ).toBe(false);
  });
  it("requires positive versions and review notes, never permits arbitrary states", () => {
    expect(
      editInspectionInput.safeParse({
        ...valid,
        id: valid.request_id,
        version: 0,
      }).success,
    ).toBe(false);
    expect(
      transitionInput.safeParse({
        id: valid.request_id,
        version: 1,
        status: "approved",
      }).success,
    ).toBe(false);
    expect(
      transitionInput.safeParse({
        id: valid.request_id,
        version: 1,
        status: "reviewed",
        review_note: "short",
      }).success,
    ).toBe(false);
  });
  it.each([
    { from: "2026-12-01", to: "2026-01-01" },
    { page: "-1" },
    { project: "foreign-invalid" },
    { status: "approved" },
    { q: "x".repeat(101) },
    { from: "2026-02-30" },
  ])("rejects unsafe filters (%#)", (filters) =>
    expect(inspectionFilters.safeParse(filters).success).toBe(false),
  );
});
