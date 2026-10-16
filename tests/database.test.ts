import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
// These minimal Supabase-owned schemas allow the real migration to run against
// embedded PostgreSQL. They do not simulate Auth HTTP or Storage HTTP behavior.
let db: PGlite;
const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002",
  viewer = "10000000-0000-4000-8000-000000000003";
let orgA: string, orgB: string;
async function asUser(id: string, sql: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return await db.query<Record<string, unknown>>(sql);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 insert into auth.users values('${alice}'),('${bob}'),('${viewer}');`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
  orgA = (
    await asUser(alice, "select public.create_organization('Company A') as id")
  ).rows[0].id as string;
  orgB = (
    await asUser(bob, "select public.create_organization('Company B') as id")
  ).rows[0].id as string;
  await db.exec(`insert into public.organization_members(organization_id,user_id,role) values('${orgA}','${viewer}','viewer');
 insert into storage.objects(bucket_id,name) values('site-evidence','${orgA}/test.jpg'),('site-evidence','${orgB}/test.jpg');`);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL migration and tenant isolation", () => {
  it("keeps privileged helper execution scoped after all migrations", async () => {
    for (const signature of [
      "public.create_organization(text)",
      "public.is_member(uuid)",
      "public.is_company_admin(uuid)",
      "public.storage_org_member(text)",
    ]) {
      const result = await db.query<{ anon: boolean; authenticated: boolean }>(
        `select has_function_privilege('anon','${signature}','execute') as anon, has_function_privilege('authenticated','${signature}','execute') as authenticated`,
      );
      expect(result.rows[0]).toEqual({ anon: false, authenticated: true });
    }
    const trigger = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','public.audit_project_creation()','execute') as allowed",
    );
    expect(trigger.rows[0].allowed).toBe(false);
    const definitions = await db.query<{
      prosecdef: boolean;
      proconfig: string[];
    }>(
      "select prosecdef,proconfig from pg_proc join pg_namespace on pg_namespace.oid=pronamespace where nspname='public' and proname in ('create_organization','is_member','is_company_admin','storage_org_member','audit_project_creation')",
    );
    expect(definitions.rows).toHaveLength(5);
    for (const fn of definitions.rows) {
      expect(fn.prosecdef).toBe(true);
      expect(fn.proconfig).toContain('search_path=""');
    }
  });
  it("atomically creates company, admin membership, and audit event", async () => {
    const result = await asUser(
      alice,
      `select role from public.organization_members where organization_id='${orgA}' and user_id='${alice}'`,
    );
    expect(result.rows).toEqual([{ role: "company_admin" }]);
    expect(
      (await asUser(alice, "select * from public.audit_logs")).rows,
    ).toHaveLength(1);
  });
  it("only reads own organization and membership", async () => {
    expect(
      (await asUser(alice, "select * from public.organizations")).rows,
    ).toHaveLength(1);
    expect(
      (
        await asUser(
          alice,
          `select * from public.organization_members where organization_id='${orgB}'`,
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("creates a persistent authorized project and audit entry", async () => {
    await asUser(
      alice,
      `insert into public.projects(organization_id,name,industry,created_by) values('${orgA}','Alpha','Construction','${alice}')`,
    );
    expect(
      (await asUser(alice, "select name from public.projects")).rows,
    ).toEqual([{ name: "Alpha" }]);
    expect(
      (
        await asUser(
          alice,
          "select * from public.audit_logs where event='project.created'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("cannot read another tenant project", async () => {
    expect(
      (await asUser(bob, "select * from public.projects")).rows,
    ).toHaveLength(0);
  });
  it("rejects cross-tenant project insertion", async () => {
    await expect(
      asUser(
        bob,
        `insert into public.projects(organization_id,name,industry,created_by) values('${orgA}','Intrusion','Construction','${bob}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("rejects forged creator IDs", async () => {
    await expect(
      asUser(
        alice,
        `insert into public.projects(organization_id,name,industry,created_by) values('${orgA}','Forged','Construction','${bob}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("viewers read company projects but cannot create projects", async () => {
    expect(
      (await asUser(viewer, "select * from public.projects")).rows,
    ).toHaveLength(1);
    await expect(
      asUser(
        viewer,
        `insert into public.projects(organization_id,name,industry,created_by) values('${orgA}','Viewer write','Construction','${viewer}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("denies membership self-promotion and direct insertion", async () => {
    await expect(
      asUser(
        viewer,
        `update public.organization_members set role='company_admin' where user_id='${viewer}'`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        bob,
        `insert into public.organization_members(organization_id,user_id,role) values('${orgA}','${bob}','company_admin')`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("denies project mutation and deletion, including other tenants", async () => {
    for (const user of [alice, bob]) {
      await expect(
        asUser(user, "update public.projects set name='Tampered'"),
      ).rejects.toThrow(/permission denied/);
      await expect(asUser(user, "delete from public.projects")).rejects.toThrow(
        /permission denied/,
      );
    }
  });
  it("does not grant anonymous access or organization creation", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.projects")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query("select public.create_organization('Intrusion')"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("denies unauthenticated RPC calls even with the authenticated role", async () => {
    await expect(
      asUser("", "select public.create_organization('Intrusion')"),
    ).rejects.toThrow(/Authentication required/);
  });
  it("rejects invalid company names without leaving records", async () => {
    await expect(
      asUser(alice, "select public.create_organization(' ')"),
    ).rejects.toThrow(/Invalid organization name/);
    expect(
      (await asUser(alice, "select * from public.organizations")).rows,
    ).toHaveLength(1);
  });
  it("only reads tenant-owned storage objects and rejects malformed prefixes", async () => {
    expect(
      (await asUser(alice, "select name from storage.objects")).rows,
    ).toEqual([{ name: `${orgA}/test.jpg` }]);
    expect(
      (
        await asUser(
          alice,
          "select public.storage_org_member('invalid/x') as allowed",
        )
      ).rows,
    ).toEqual([{ allowed: false }]);
  });
  it("denies storage insertion, mutation and deletion until upload workflow exists", async () => {
    await expect(
      asUser(
        alice,
        `insert into storage.objects(bucket_id,name) values('site-evidence','${orgB}/attack.jpg')`,
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (
        await asUser(
          alice,
          "update storage.objects set name='tampered' returning *",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(alice, "delete from storage.objects returning *")).rows,
    ).toHaveLength(0);
  });
  it("denies forged audit events and audit deletion", async () => {
    await expect(
      asUser(
        alice,
        `insert into public.audit_logs(organization_id,actor_id,event) values('${orgA}','${alice}','forged')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(alice, "delete from public.audit_logs"),
    ).rejects.toThrow(/permission denied/);
  });
  it("does not reveal company audit records to a viewer", async () => {
    expect(
      (await asUser(viewer, "select * from public.audit_logs")).rows,
    ).toHaveLength(0);
  });
  it("keeps the evidence bucket private with type and size limits", async () => {
    const result = await db.query(
      "select public,file_size_limit,allowed_mime_types from storage.buckets",
    );
    expect(result.rows[0]).toEqual({
      public: false,
      file_size_limit: 10485760,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    });
  });
});

describe("final permission boundary review (embedded PostgreSQL, not hosted APIs)", () => {
  it("enables RLS on every tenant table", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relname in ('organizations','organization_members','projects','audit_logs')",
    );
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it("denies direct company/member/audit writes and all tenant-table deletes", async () => {
    for (const table of [
      "organizations",
      "organization_members",
      "projects",
      "audit_logs",
    ]) {
      const result = await db.query<{
        insert: boolean;
        update: boolean;
        delete: boolean;
      }>(
        `select has_table_privilege('authenticated','public.${table}','insert') as insert, has_table_privilege('authenticated','public.${table}','update') as update, has_table_privilege('authenticated','public.${table}','delete') as delete`,
      );
      expect(result.rows[0]).toEqual({
        insert: table === "projects",
        update: false,
        delete: false,
      });
      for (const privilege of ["select", "insert", "update", "delete"]) {
        const anon = await db.query<{ allowed: boolean }>(
          `select has_table_privilege('anon','public.${table}','${privilege}') as allowed`,
        );
        expect(anon.rows[0].allowed).toBe(false);
      }
    }
  });
  it.each(["hse_manager", "hse_officer", "supervisor", "viewer"])(
    "%s cannot write projects or read admin audit logs",
    async (role) => {
      await db.exec("begin");
      try {
        await db.exec(
          `update public.organization_members set role='${role}' where user_id='${viewer}'`,
        );
        expect(
          (
            await asUser(
              viewer,
              `select * from public.projects where organization_id='${orgA}'`,
            )
          ).rows,
        ).toHaveLength(1);
        expect(
          (await asUser(viewer, "select * from public.audit_logs")).rows,
        ).toHaveLength(0);
        // Assert the original policy denial before rolling back the failed transaction.
        await db.exec(
          `set role authenticated; select set_config('request.jwt.claim.sub','${viewer}',false)`,
        );
        await expect(
          db.query(
            `insert into public.projects(organization_id,name,industry,created_by) values('${orgA}','Role intrusion','Construction','${viewer}')`,
          ),
        ).rejects.toThrow(/row-level security/);
      } finally {
        await db.exec("rollback");
        await db.exec("reset role");
      }
    },
  );
  it("revoked membership removes table and storage visibility with the same identity", async () => {
    await db.exec("begin");
    try {
      await db.exec(
        `delete from public.organization_members where organization_id='${orgA}' and user_id='${alice}'`,
      );
      for (const table of [
        "organizations",
        "organization_members",
        "projects",
        "audit_logs",
      ]) {
        expect(
          (await asUser(alice, `select * from public.${table}`)).rows,
        ).toHaveLength(0);
      }
      expect(
        (await asUser(alice, "select * from storage.objects")).rows,
      ).toHaveLength(0);
      expect(
        (
          await asUser(
            alice,
            `select public.is_company_admin('${orgA}') as allowed`,
          )
        ).rows,
      ).toEqual([{ allowed: false }]);
    } finally {
      await db.exec("rollback");
    }
  });
  it("keeps project filters separate when one identity belongs to two companies", async () => {
    await db.exec("begin");
    try {
      const orgC = (
        await asUser(
          alice,
          "select public.create_organization('Company C') as id",
        )
      ).rows[0].id as string;
      await asUser(
        alice,
        `insert into public.projects(organization_id,name,industry,created_by) values('${orgC}','Gamma','Construction','${alice}')`,
      );
      expect(
        (
          await asUser(
            alice,
            `select name from public.projects where organization_id='${orgA}'`,
          )
        ).rows,
      ).toEqual([{ name: "Alpha" }]);
      expect(
        (
          await asUser(
            alice,
            `select name from public.projects where organization_id='${orgC}'`,
          )
        ).rows,
      ).toEqual([{ name: "Gamma" }]);
      expect(
        (
          await asUser(
            bob,
            `select * from public.projects where organization_id in ('${orgA}','${orgC}')`,
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec("rollback");
    }
  });
  it("does not authorize another bucket or a misleading organization prefix", async () => {
    await db.exec("begin");
    try {
      await db.exec(
        `insert into storage.objects(bucket_id,name) values('other-bucket','${orgA}/other.jpg'),('site-evidence','${orgA}-suffix/other.jpg'),('site-evidence','/${orgA}/other.jpg')`,
      );
      expect(
        (await asUser(alice, "select name from storage.objects")).rows,
      ).toEqual([{ name: `${orgA}/test.jpg` }]);
      await db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`,
      );
      await expect(
        db.query(
          `insert into storage.objects(bucket_id,name) values('site-evidence','${orgA}/own-upload.jpg')`,
        ),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec("rollback");
      await db.exec("reset role");
    }
  });
});
