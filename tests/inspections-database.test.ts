/** Real embedded PostgreSQL migrations/permissions. NOT hosted Supabase API tests. */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const users = {
  admin: randomUUID(),
  foreign: randomUUID(),
  hse_manager: randomUUID(),
  hse_officer: randomUUID(),
  supervisor: randomUUID(),
  viewer: randomUUID(),
};
let org: string, foreignOrg: string, project: string, foreignProject: string;
async function asUser(user: string, sql: string, args: unknown[] = []) {
  await db.exec("set role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    return await db.query<Record<string, unknown>>(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
async function create(
  user: string = users.hse_officer,
  changes: Record<string, unknown> = {},
) {
  const v = {
    org,
    project,
    request: randomUUID(),
    title: "Scaffold inspection",
    area: "North platform",
    date: "2026-10-16T12:00:00Z",
    inspector: "Synthetic inspector",
    description: "Pre-task walk",
    observations: "Guardrails require review",
    ...changes,
  };
  const result = await asUser(
    user,
    "select public.create_inspection($1,$2,$3,$4,$5,$6,$7,$8,$9) as id",
    [
      v.org,
      v.project,
      v.request,
      v.title,
      v.area,
      v.date,
      v.inspector,
      v.description,
      v.observations,
    ],
  );
  return result.rows[0].id as string;
}
async function transition(
  user: string,
  id: string,
  version: number,
  status: string,
  note = "",
) {
  return asUser(user, "select public.transition_inspection($1,$2,$3,$4)", [
    id,
    version,
    status,
    note,
  ]);
}
async function edit(
  user: string,
  id: string,
  version = 1,
  title = "Edited inspection",
) {
  return asUser(
    user,
    "select public.update_inspection_draft($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      id,
      version,
      title,
      "South platform",
      "2026-10-17T12:00:00Z",
      "Synthetic inspector",
      "Updated description",
      "Updated observations",
    ],
  );
}
async function record(user: string, id: string) {
  return (
    await asUser(user, "select * from public.inspections where id=$1", [id])
  ).rows[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const id of Object.values(users))
    await db.query("insert into auth.users values($1)", [id]);
  org = (
    await asUser(
      users.admin,
      "select public.create_organization('Inspection Company') as id",
    )
  ).rows[0].id as string;
  foreignOrg = (
    await asUser(
      users.foreign,
      "select public.create_organization('Other Company') as id",
    )
  ).rows[0].id as string;
  for (const role of [
    "hse_manager",
    "hse_officer",
    "supervisor",
    "viewer",
  ] as const)
    await db.query(
      "insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)",
      [org, users[role], role],
    );
  project = (
    await asUser(
      users.admin,
      "insert into public.projects(organization_id,name,industry,created_by) values($1,'Main site','Construction',$2) returning id",
      [org, users.admin],
    )
  ).rows[0].id as string;
  foreignProject = (
    await asUser(
      users.foreign,
      "insert into public.projects(organization_id,name,industry,created_by) values($1,'Foreign site','Oil & Gas',$2) returning id",
      [foreignOrg, users.foreign],
    )
  ).rows[0].id as string;
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("inspection persistence, workflow and PostgreSQL security", () => {
  it.each(["admin", "hse_manager", "hse_officer", "supervisor"] as const)(
    "%s can create and persist its own draft",
    async (role) => {
      const id = await create(users[role]);
      const r = await record(users[role], id);
      expect(r).toMatchObject({
        organization_id: org,
        project_id: project,
        created_by: users[role],
        status: "draft",
        version: 1,
      });
      // Separate calls/identities exercise persistence rather than component state.
      expect(await record(users.viewer, id)).toMatchObject({ id });
      const history = await asUser(
        users.viewer,
        "select event,actor_id from public.inspection_history where inspection_id=$1",
        [id],
      );
      expect(history.rows).toEqual([
        { event: "created", actor_id: users[role] },
      ]);
    },
  );
  it("viewer cannot create, edit or submit", async () => {
    await expect(create(users.viewer)).rejects.toThrow(/denied/);
    const id = await create();
    await expect(edit(users.viewer, id)).rejects.toThrow(/denied/);
    await expect(transition(users.viewer, id, 1, "submitted")).rejects.toThrow(
      /denied/,
    );
  });
  it("author edits, submits and another reviewer completes a human review", async () => {
    const id = await create();
    await edit(users.hse_officer, id);
    expect(await record(users.viewer, id)).toMatchObject({
      title: "Edited inspection",
      version: 2,
    });
    await transition(users.hse_officer, id, 2, "submitted");
    await transition(users.hse_manager, id, 3, "under_review");
    await transition(
      users.hse_manager,
      id,
      4,
      "reviewed",
      "Human review completed; follow up at site.",
    );
    expect(await record(users.viewer, id)).toMatchObject({
      status: "reviewed",
      version: 5,
      reviewer_id: users.hse_manager,
    });
    const h = await asUser(
      users.viewer,
      "select event,version from public.inspection_history where inspection_id=$1 order by version",
      [id],
    );
    expect(h.rows.map((r) => r.event)).toEqual([
      "created",
      "draft_updated",
      "submitted",
      "review_started",
      "reviewed",
    ]);
    expect(h.rows.map((r) => r.version)).toEqual([1, 2, 3, 4, 5]);
  });
  it("stale edits and duplicate submissions fail without duplicate history", async () => {
    const id = await create();
    await edit(users.hse_officer, id);
    await expect(edit(users.hse_officer, id, 1)).rejects.toThrow(/changed/);
    await transition(users.hse_officer, id, 2, "submitted");
    await expect(
      transition(users.hse_officer, id, 2, "submitted"),
    ).rejects.toThrow(/changed/);
    expect(
      (
        await asUser(
          users.admin,
          "select * from public.inspection_history where inspection_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(3);
  });
  it("deduplicates repeated create requests but rejects changed payloads", async () => {
    const request = randomUUID();
    const id = await create(users.hse_officer, { request });
    expect(await create(users.hse_officer, { request })).toBe(id);
    expect(
      (
        await asUser(
          users.viewer,
          "select * from public.inspection_history where inspection_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      create(users.hse_officer, { request, title: "Different payload" }),
    ).rejects.toThrow(/different data/);
  });
  it("cross-company inspection and history reads return no rows; RPC writes denied", async () => {
    const id = await create();
    expect(await record(users.foreign, id)).toBeUndefined();
    expect(
      (
        await asUser(
          users.foreign,
          "select * from public.inspection_history where inspection_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(edit(users.foreign, id)).rejects.toThrow(/unavailable/);
    await expect(transition(users.foreign, id, 1, "submitted")).rejects.toThrow(
      /unavailable/,
    );
    await expect(create(users.foreign)).rejects.toThrow(/denied/);
  });
  it("rejects a foreign project under a permitted company", async () => {
    await expect(
      create(users.hse_officer, { project: foreignProject }),
    ).rejects.toThrow(/unavailable/);
  });
  it("composite FK rejects mismatched company/project even under owner access", async () => {
    await expect(
      db.query(
        "insert into public.inspections(organization_id,project_id,request_id,title,work_area,inspected_at,inspector_name,created_by) values($1,$2,$3,'Bad reference','Area','2026-10-16','Tester',$4)",
        [org, foreignProject, randomUUID(), users.admin],
      ),
    ).rejects.toThrow(/foreign key/);
  });
  it("cannot edit another author's draft even as company admin", async () => {
    const id = await create();
    await expect(edit(users.admin, id)).rejects.toThrow(/denied/);
    await expect(transition(users.admin, id, 1, "submitted")).rejects.toThrow(
      /denied/,
    );
  });
  it("submitted records are immutable to their author", async () => {
    const id = await create();
    await transition(users.hse_officer, id, 1, "submitted");
    await expect(edit(users.hse_officer, id, 2)).rejects.toThrow(/changed/);
  });
  it.each(["draft", "under_review", "reviewed", "approved", "", null])(
    "rejects an invalid draft transition to %s",
    async (status) => {
      const id = await create();
      await expect(
        transition(users.hse_officer, id, 1, status as string),
      ).rejects.toThrow(/denied/);
      expect(await record(users.viewer, id)).toMatchObject({
        status: "draft",
        version: 1,
      });
    },
  );
  it("does not permit self-review, even for admins", async () => {
    const id = await create(users.admin);
    await transition(users.admin, id, 1, "submitted");
    await expect(
      transition(users.admin, id, 2, "under_review"),
    ).rejects.toThrow(/denied/);
  });
  it.each(["hse_officer", "supervisor", "viewer"] as const)(
    "%s cannot begin review",
    async (role) => {
      const id = await create(users.admin);
      await transition(users.admin, id, 1, "submitted");
      await expect(
        transition(users[role], id, 2, "under_review"),
      ).rejects.toThrow(/denied/);
    },
  );
  it("only assigned reviewer can complete review and notes are mandatory", async () => {
    const id = await create();
    await transition(users.hse_officer, id, 1, "submitted");
    await transition(users.hse_manager, id, 2, "under_review");
    await expect(
      transition(users.admin, id, 3, "reviewed", "Another reviewer note"),
    ).rejects.toThrow(/denied/);
    await expect(
      transition(users.hse_manager, id, 3, "reviewed", "short"),
    ).rejects.toThrow(/denied/);
    await expect(
      transition(users.admin, id, 3, "under_review"),
    ).rejects.toThrow(/denied/);
  });
  it("revoking membership removes reads, history and RPC writes", async () => {
    const id = await create();
    await db.query(
      "delete from public.organization_members where organization_id=$1 and user_id=$2",
      [org, users.hse_officer],
    );
    try {
      expect(await record(users.hse_officer, id)).toBeUndefined();
      expect(
        (
          await asUser(
            users.hse_officer,
            "select * from public.inspection_history where inspection_id=$1",
            [id],
          )
        ).rows,
      ).toHaveLength(0);
      await expect(edit(users.hse_officer, id)).rejects.toThrow(/unavailable/);
      await expect(
        transition(users.hse_officer, id, 1, "submitted"),
      ).rejects.toThrow(/unavailable/);
      await expect(create()).rejects.toThrow(/denied/);
    } finally {
      await db.query(
        "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'hse_officer')",
        [org, users.hse_officer],
      );
    }
  });
  it("role downgrade to viewer prevents mutations despite author/reviewer identity", async () => {
    const id = await create(users.hse_manager);
    await db.query(
      "update public.organization_members set role='viewer' where organization_id=$1 and user_id=$2",
      [org, users.hse_manager],
    );
    try {
      await expect(edit(users.hse_manager, id)).rejects.toThrow(/denied/);
      await expect(
        transition(users.hse_manager, id, 1, "submitted"),
      ).rejects.toThrow(/denied/);
    } finally {
      await db.query(
        "update public.organization_members set role='hse_manager' where organization_id=$1 and user_id=$2",
        [org, users.hse_manager],
      );
    }
  });
  it.each([
    { title: " " },
    { area: "" },
    { date: "infinity" },
    { inspector: "" },
    { description: "x".repeat(8001) },
    { observations: null },
    { request: null },
  ])("SQL constraints reject invalid data (%#)", async (changes) => {
    await expect(create(users.hse_officer, changes)).rejects.toThrow();
  });
  it("direct updates/deletes/inserts cannot forge status, identity or history", async () => {
    const id = await create();
    for (const user of [users.admin, users.foreign, users.viewer]) {
      await expect(
        asUser(
          user,
          "update public.inspections set status='reviewed',created_by=$1 where id=$2",
          [user, id],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(user, "delete from public.inspections where id=$1", [id]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(
          user,
          "delete from public.inspection_history where inspection_id=$1",
          [id],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(
          user,
          "insert into public.inspection_history(organization_id,inspection_id,actor_id,event,to_status,version) values($1,$2,$3,'reviewed','reviewed',99)",
          [org, id, user],
        ),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      asUser(users.admin, "insert into public.inspections default values"),
    ).rejects.toThrow(/permission denied/);
  });
  it("anonymous/no-identity calls fail; trigger cannot be called directly", async () => {
    await expect(create("")).rejects.toThrow(/denied/);
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select * from public.inspections"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select public.transition_inspection($1,1,'submitted','')", [
          randomUUID(),
        ]),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await expect(
      asUser(users.admin, "select public.record_inspection_history()"),
    ).rejects.toThrow(/permission denied/);
  });
  it("new definer functions have fixed search paths and explicit execute grants", async () => {
    const functions = await db.query<{
      proname: string;
      proconfig: string[];
      anon: boolean;
      authenticated: boolean;
    }>(
      "select proname,proconfig,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('create_inspection','update_inspection_draft','transition_inspection','record_inspection_history')",
    );
    expect(functions.rows).toHaveLength(4);
    for (const f of functions.rows) {
      expect(f.proconfig).toContain('search_path=""');
      expect(f.anon).toBe(false);
      expect(f.authenticated).toBe(f.proname !== "record_inspection_history");
    }
    const tables = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relname in ('inspections','inspection_history')",
    );
    expect(tables.rows).toHaveLength(2);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
  });
});
