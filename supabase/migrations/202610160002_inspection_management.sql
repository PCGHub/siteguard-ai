-- Inspection records only. No evidence write policies or automatic safety approval.
alter table public.projects add constraint projects_organization_id_id_key unique(organization_id,id);
create table public.inspections (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 project_id uuid not null,
 request_id uuid not null,
 title text not null check(char_length(btrim(title)) between 2 and 160),
 work_area text not null check(char_length(btrim(work_area)) between 2 and 200),
 inspected_at timestamptz not null check(inspected_at >= '2000-01-01 UTC' and inspected_at < '2100-01-01 UTC'),
 inspector_name text not null check(char_length(btrim(inspector_name)) between 2 and 120),
 description text not null default '' check(char_length(description)<=8000),
 observations text not null default '' check(char_length(observations)<=8000),
 created_by uuid not null references auth.users(id) on delete restrict,
 status text not null default 'draft' check(status in ('draft','submitted','under_review','reviewed')),
 version integer not null default 1 check(version>0),
 reviewer_id uuid references auth.users(id) on delete restrict,
 review_note text not null default '' check(char_length(review_note)<=4000),
 submitted_at timestamptz,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
 unique(organization_id,id),
 unique(created_by,request_id),
 check(reviewer_id is null or reviewer_id<>created_by),
 check((status='draft' and submitted_at is null and reviewer_id is null and reviewed_at is null)
    or (status='submitted' and submitted_at is not null and reviewer_id is null and reviewed_at is null)
    or (status='under_review' and submitted_at is not null and reviewer_id is not null and reviewed_at is null)
    or (status='reviewed' and submitted_at is not null and reviewer_id is not null and reviewed_at is not null and char_length(btrim(review_note))>=10))
);
create index inspections_org_date_idx on public.inspections(organization_id,inspected_at desc,id);
create index inspections_org_project_status_idx on public.inspections(organization_id,project_id,status);
create index inspections_creator_idx on public.inspections(created_by);
create index inspections_reviewer_idx on public.inspections(reviewer_id);
create table public.inspection_history (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 inspection_id uuid not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(event in ('created','draft_updated','submitted','review_started','reviewed')),
 from_status text,
 to_status text not null,
 version integer not null,
 created_at timestamptz not null default now(),
 foreign key(organization_id,inspection_id) references public.inspections(organization_id,id) on delete restrict,
 unique(inspection_id,version)
);
create index inspection_history_org_idx on public.inspection_history(organization_id,inspection_id,version);
alter table public.inspections enable row level security;
alter table public.inspection_history enable row level security;
revoke all on public.inspections,public.inspection_history from public,anon,authenticated;
grant select on public.inspections,public.inspection_history to authenticated;
create policy inspections_read on public.inspections for select to authenticated using(public.is_member(organization_id));
create policy inspection_history_read on public.inspection_history for select to authenticated using(public.is_member(organization_id));

create function public.record_inspection_history() returns trigger language plpgsql security definer set search_path='' as $$
declare action text; previous text;
begin
 if tg_op='INSERT' then action:='created'; previous:=null;
 else
  previous:=old.status;
  action:=case when new.status=old.status then 'draft_updated' when new.status='under_review' then 'review_started' else new.status end;
 end if;
 insert into public.inspection_history(organization_id,inspection_id,actor_id,event,from_status,to_status,version)
 values(new.organization_id,new.id,auth.uid(),action,previous,new.status,new.version);
 insert into public.audit_logs(organization_id,actor_id,event) values(new.organization_id,auth.uid(),'inspection.'||action);
 return new;
end; $$;
revoke all on function public.record_inspection_history() from public,anon,authenticated;
create trigger inspection_changed after insert or update on public.inspections for each row execute function public.record_inspection_history();

create function public.create_inspection(p_organization_id uuid,p_project_id uuid,p_request_id uuid,p_title text,p_work_area text,p_inspected_at timestamptz,p_inspector_name text,p_description text,p_observations text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); member_role text; result public.inspections;
begin
 select role into member_role from public.organization_members where organization_id=p_organization_id and user_id=actor for share;
 if actor is null or member_role is null or member_role not in ('company_admin','hse_manager','hse_officer','supervisor') then raise exception 'Inspection access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.projects where organization_id=p_organization_id and id=p_project_id) then raise exception 'Inspection project unavailable' using errcode='42501'; end if;
 insert into public.inspections(organization_id,project_id,request_id,title,work_area,inspected_at,inspector_name,description,observations,created_by)
 values(p_organization_id,p_project_id,p_request_id,btrim(p_title),btrim(p_work_area),p_inspected_at,btrim(p_inspector_name),p_description,p_observations,actor)
 on conflict(created_by,request_id) do nothing;
 select * into result from public.inspections where created_by=actor and request_id=p_request_id;
 if result.organization_id is distinct from p_organization_id or result.project_id is distinct from p_project_id or result.title is distinct from btrim(p_title) or result.work_area is distinct from btrim(p_work_area) or result.inspected_at is distinct from p_inspected_at or result.inspector_name is distinct from btrim(p_inspector_name) or result.description is distinct from p_description or result.observations is distinct from p_observations then
  raise exception 'Request already used with different data' using errcode='22023';
 end if;
 return result.id;
end; $$;

create function public.update_inspection_draft(p_id uuid,p_version integer,p_title text,p_work_area text,p_inspected_at timestamptz,p_inspector_name text,p_description text,p_observations text)
returns uuid language plpgsql security definer set search_path='' as $$
declare record public.inspections; actor uuid:=auth.uid(); member_role text;
begin
 select * into record from public.inspections where id=p_id and public.is_member(organization_id) for update;
 if not found or actor is null then raise exception 'Inspection unavailable' using errcode='42501'; end if;
 select role into member_role from public.organization_members where organization_id=record.organization_id and user_id=actor for share;
 if member_role is null or member_role not in ('company_admin','hse_manager','hse_officer','supervisor') or record.created_by<>actor then raise exception 'Inspection access denied' using errcode='42501'; end if;
 if p_version is null or record.version<>p_version or record.status<>'draft' then raise exception 'Inspection changed; reload before retrying' using errcode='40001'; end if;
 update public.inspections set title=btrim(p_title),work_area=btrim(p_work_area),inspected_at=p_inspected_at,inspector_name=btrim(p_inspector_name),description=p_description,observations=p_observations,version=version+1,updated_at=now() where id=p_id;
 return p_id;
end; $$;

create function public.transition_inspection(p_id uuid,p_version integer,p_status text,p_review_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare record public.inspections; actor uuid:=auth.uid(); member_role text;
begin
 select * into record from public.inspections where id=p_id and public.is_member(organization_id) for update;
 if not found or actor is null then raise exception 'Inspection unavailable' using errcode='42501'; end if;
 select role into member_role from public.organization_members where organization_id=record.organization_id and user_id=actor for share;
 if member_role is null or member_role='viewer' then raise exception 'Inspection access denied' using errcode='42501'; end if;
 if p_version is null or record.version<>p_version then raise exception 'Inspection changed; reload before retrying' using errcode='40001'; end if;
 if record.status='draft' and p_status='submitted' and record.created_by=actor then
  update public.inspections set status='submitted',submitted_at=now(),version=version+1,updated_at=now() where id=p_id;
 elsif record.status='submitted' and p_status='under_review' and member_role in ('company_admin','hse_manager') and record.created_by<>actor then
  update public.inspections set status='under_review',reviewer_id=actor,version=version+1,updated_at=now() where id=p_id;
 elsif record.status='under_review' and p_status='reviewed' and member_role in ('company_admin','hse_manager') and record.reviewer_id=actor and record.created_by<>actor and char_length(btrim(p_review_note)) between 10 and 4000 then
  update public.inspections set status='reviewed',review_note=btrim(p_review_note),reviewed_at=now(),version=version+1,updated_at=now() where id=p_id;
 else raise exception 'Inspection transition denied' using errcode='42501'; end if;
 return p_id;
end; $$;
revoke all on function public.create_inspection(uuid,uuid,uuid,text,text,timestamptz,text,text,text),public.update_inspection_draft(uuid,integer,text,text,timestamptz,text,text,text),public.transition_inspection(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_inspection(uuid,uuid,uuid,text,text,timestamptz,text,text,text),public.update_inspection_draft(uuid,integer,text,text,timestamptz,text,text,text),public.transition_inspection(uuid,integer,text,text) to authenticated;
