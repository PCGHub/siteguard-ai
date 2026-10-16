/** Server-action wiring/validation, mocked session/RPC. Not hosted API testing. */
import { beforeEach, describe, it, expect, vi } from "vitest";
const fixture = vi.hoisted(() => ({ rpc: vi.fn(), authenticated: true }));
vi.mock("@/lib/inspections/server", () => ({
  inspectionSession: async () => {
    if (!fixture.authenticated) throw new Error("Login required");
    return { db: { rpc: fixture.rpc }, user: { id: "fixture" } };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  createInspection,
  editInspection,
  transitionInspection,
} from "../app/inspections/actions";
const id = "10000000-0000-4000-8000-000000000001";
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const fields = {
  title: "Site inspection",
  work_area: "Platform A",
  inspected_at: "2026-10-16T12:30",
  inspector_name: "Tester",
  description: "",
  observations: "",
};
beforeEach(() => {
  fixture.rpc.mockReset();
  fixture.rpc.mockResolvedValue({ data: id, error: null });
  fixture.authenticated = true;
});
async function digest(action: () => Promise<void>) {
  try {
    await action();
    throw new Error("Expected redirect");
  } catch (e) {
    return (e as { digest?: string }).digest ?? String(e);
  }
}
describe("inspection server action contract", () => {
  it("creates through the narrow RPC without trusting actor/status fields", async () => {
    const result = await digest(() =>
      createInspection(
        form({
          ...fields,
          organization_id: id,
          project_id: id,
          request_id: id,
          created_by: "forged",
          status: "reviewed",
        }),
      ),
    );
    expect(result).toContain(`/inspections/${id}`);
    expect(fixture.rpc).toHaveBeenCalledWith("create_inspection", {
      p_title: fields.title,
      p_work_area: fields.work_area,
      p_inspected_at: "2026-10-16T12:30:00Z",
      p_inspector_name: "Tester",
      p_description: "",
      p_observations: "",
      p_organization_id: id,
      p_project_id: id,
      p_request_id: id,
    });
  });
  it("draft edits send expected version but cannot change project or author", async () => {
    await digest(() =>
      editInspection(
        form({
          ...fields,
          id,
          version: "3",
          project_id: "forged",
          created_by: "forged",
        }),
      ),
    );
    expect(fixture.rpc).toHaveBeenCalledWith(
      "update_inspection_draft",
      expect.objectContaining({ p_id: id, p_version: 3 }),
    );
    expect(fixture.rpc.mock.calls[0][1]).not.toHaveProperty("p_project_id");
  });
  it("surfaces a stale-version error instead of claiming save success", async () => {
    fixture.rpc.mockResolvedValue({ error: { code: "40001" } });
    const result = await digest(() =>
      editInspection(form({ ...fields, id, version: "1" })),
    );
    expect(result).toContain(`/inspections/${id}/edit?`);
    expect(result).toContain("changed");
  });
  it("sends only validated transition fields", async () => {
    await digest(() =>
      transitionInspection(
        form({
          id,
          version: "2",
          status: "under_review",
          reviewer_id: "forged",
        }),
      ),
    );
    expect(fixture.rpc).toHaveBeenCalledWith("transition_inspection", {
      p_id: id,
      p_version: 2,
      p_status: "under_review",
      p_review_note: "",
    });
  });
  it.each([createInspection, editInspection, transitionInspection])(
    "malformed requests never call RPC (%#)",
    async (action) => {
      await digest(() =>
        action(form({ id: "bad", organization_id: "https://evil.example" })),
      );
      expect(fixture.rpc).not.toHaveBeenCalled();
    },
  );
  it("unauthenticated mutations do not call RPC", async () => {
    fixture.authenticated = false;
    await expect(
      transitionInspection(form({ id, version: "1", status: "submitted" })),
    ).rejects.toThrow("Login required");
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("provider errors stay generic, with no database payload exposed", async () => {
    fixture.rpc.mockResolvedValue({
      error: { code: "42501", message: "private fixture detail" },
    });
    const result = await digest(() =>
      transitionInspection(form({ id, version: "1", status: "submitted" })),
    );
    expect(result).toContain("Unable");
    expect(result).not.toContain("private");
  });
});
