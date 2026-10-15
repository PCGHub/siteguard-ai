create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 2 and 100),
 created_at timestamptz not null default now()
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('company_admin','hse_manager','hse_officer','supervisor','viewer')),
 created_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create index members_user_idx on public.organization_members(user_id);
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 name text not null check(char_length(btrim(name)) between 2 and 120),
 location text not null default '' check(char_length(location)<=200),
 industry text not null check(industry in ('Construction','Oil & Gas','Manufacturing','Industrial maintenance')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(organization_id,name)
);
create index projects_org_idx on public.projects(organization_id);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null,
 created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.audit_logs enable row level security;
-- Fixed search path and explicit grants keep definer functions narrowly scoped.
create function public.is_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id=org and user_id=(select auth.uid()));
$$;
create function public.is_company_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id=org and user_id=(select auth.uid()) and role='company_admin');
$$;
revoke all on function public.is_member(uuid),public.is_company_admin(uuid) from public;
grant execute on function public.is_member(uuid),public.is_company_admin(uuid) to authenticated;
create policy organizations_read on public.organizations for select to authenticated using(public.is_member(id));
create policy members_read on public.organization_members for select to authenticated using(public.is_member(organization_id));
create policy projects_read on public.projects for select to authenticated using(public.is_member(organization_id));
create policy projects_create on public.projects for insert to authenticated with check(public.is_company_admin(organization_id) and created_by=(select auth.uid()));
create policy audit_read on public.audit_logs for select to authenticated using(public.is_company_admin(organization_id));
revoke all on public.organizations,public.organization_members,public.projects,public.audit_logs from anon,authenticated;
grant select on public.organizations,public.organization_members,public.projects,public.audit_logs to authenticated;
grant insert on public.projects to authenticated;
create function public.create_organization(organization_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; actor uuid := auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if char_length(btrim(organization_name)) not between 2 and 100 then raise exception 'Invalid organization name'; end if;
 insert into public.organizations(name) values(btrim(organization_name)) returning id into org;
 insert into public.organization_members(organization_id,user_id,role) values(org,actor,'company_admin');
 insert into public.audit_logs(organization_id,actor_id,event) values(org,actor,'organization.created');
 return org;
end;
$$;
revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;
create function public.audit_project_creation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(organization_id,actor_id,event) values(new.organization_id,auth.uid(),'project.created');
 return new;
end;
$$;
revoke all on function public.audit_project_creation() from public;
create trigger project_created after insert on public.projects for each row execute function public.audit_project_creation();
-- Private storage foundation; no upload UI is exposed in this milestone.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('site-evidence','site-evidence',false,10485760,array['image/jpeg','image/png','image/webp']);
-- Object keys must begin with organization UUID. Invalid prefixes simply fail closed.
create function public.storage_org_member(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id::text=split_part(object_name,'/',1) and user_id=(select auth.uid()));
$$;
revoke all on function public.storage_org_member(text) from public;
grant execute on function public.storage_org_member(text) to authenticated;
create policy evidence_read on storage.objects for select to authenticated using(bucket_id='site-evidence' and public.storage_org_member(name));
-- Upload/update/delete remain denied until the validated evidence workflow is implemented.
