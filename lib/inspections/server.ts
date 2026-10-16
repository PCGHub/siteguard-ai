import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { configured, supabase } from "@/lib/supabase/server";
export async function inspectionSession() {
  if (!configured())
    redirect("/login?message=Supabase+configuration+is+required.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return { db, user };
}
export async function inspectionContext(org?: string) {
  const { db, user } = await inspectionSession();
  if (org !== undefined && !z.uuid().safeParse(org).success) notFound();
  const { data: members, error } = await db
    .from("organization_members")
    .select("organization_id,role,organizations(name)")
    .eq("user_id", user.id);
  if (error) throw new Error("Company data unavailable.");
  if (!members?.length) redirect("/onboarding");
  const member = org
    ? members.find((m) => m.organization_id === org)
    : members[0];
  if (!member) notFound();
  const { data: projects, error: projectError } = await db
    .from("projects")
    .select("id,name")
    .eq("organization_id", member.organization_id)
    .order("name");
  if (projectError) throw new Error("Projects unavailable.");
  return { db, user, member, projects: projects ?? [], members };
}
export async function inspectionRecord(id: string) {
  const session = await inspectionSession();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: record, error } = await session.db
    .from("inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new Error("Inspection unavailable. Check the development migration.");
  if (!record) notFound();
  const { data: member, error: memberError } = await session.db
    .from("organization_members")
    .select("role")
    .eq("organization_id", record.organization_id)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (memberError) throw new Error("Company access unavailable.");
  if (!member) notFound();
  return { ...session, record, role: String(member.role) };
}
