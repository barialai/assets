-- Run in the SQL editor of a dedicated Supabase project.
-- No public backup files, no service-role key and no browser-running cron.
begin;
create schema if not exists vault_private;
revoke all on schema vault_private from public, anon;
grant usage on schema vault_private to authenticated;

create table if not exists public.vault_allowed_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.vault_allowed_users enable row level security;
revoke all on public.vault_allowed_users from public,anon,authenticated;
grant select on public.vault_allowed_users to authenticated;
drop policy if exists vault_own_membership on public.vault_allowed_users;
create policy vault_own_membership on public.vault_allowed_users for select to authenticated using(user_id=(select auth.uid()));

create table if not exists public.vault_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check(revision>0),
  timezone text not null default 'UTC',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.vault_workspaces enable row level security;
revoke all on public.vault_workspaces from public,anon,authenticated;
grant select on public.vault_workspaces to authenticated;
drop policy if exists vault_own_workspace on public.vault_workspaces;
create policy vault_own_workspace on public.vault_workspaces for select to authenticated using (
  user_id=(select auth.uid()) and exists(select 1 from public.vault_allowed_users a where a.user_id=(select auth.uid()))
);

create table if not exists vault_private.revisions (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  mutation_id uuid not null,
  data jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,revision),unique(user_id,mutation_id)
);
create index if not exists vault_revision_cutoff on vault_private.revisions(user_id,created_at desc,revision desc);
alter table vault_private.revisions enable row level security;
revoke all on vault_private.revisions from public,anon,authenticated;

create table if not exists public.vault_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('daily','manual','before-restore','before-replace')),
  backup_day date not null,
  timezone text not null,
  revision bigint not null,
  data jsonb not null,
  source_saved_at timestamptz not null,
  cutoff_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create unique index if not exists vault_daily_once on public.vault_backups(user_id,backup_day) where kind='daily';
create index if not exists vault_backup_recent on public.vault_backups(user_id,created_at desc);
alter table public.vault_backups enable row level security;
revoke all on public.vault_backups from public,anon,authenticated;
grant select on public.vault_backups to authenticated;
drop policy if exists vault_own_backups on public.vault_backups;
create policy vault_own_backups on public.vault_backups for select to authenticated using (
 user_id=(select auth.uid()) and exists(select 1 from public.vault_allowed_users a where a.user_id=(select auth.uid()))
);

create table if not exists vault_private.job_health(id boolean primary key default true check(id),last_success timestamptz,backup_count integer not null default 0);
alter table vault_private.job_health enable row level security;
revoke all on vault_private.job_health from public,anon,authenticated;

create or replace function vault_private.require_owner() returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid();
begin
 if v_id is null or not exists(select 1 from public.vault_allowed_users where user_id=v_id) then
   raise exception 'VAULT_NOT_ALLOWED' using errcode='42501';
 end if;
 return v_id;
end; $$;

create or replace function vault_private.validate_data(p_data jsonb) returns void
language plpgsql set search_path='' as $$
begin
 if p_data is null or pg_catalog.jsonb_typeof(p_data) is distinct from 'object'
 or p_data->>'version' is distinct from '2' or p_data->>'demo' is distinct from 'false'
 or pg_catalog.jsonb_typeof(p_data->'profile') is distinct from 'object'
 or pg_catalog.jsonb_typeof(p_data->'settings') is distinct from 'object'
 or pg_catalog.jsonb_typeof(p_data->'assets') is distinct from 'array'
 or pg_catalog.jsonb_typeof(p_data->'entries') is distinct from 'array'
 or pg_catalog.jsonb_typeof(p_data->'loans') is distinct from 'array'
 or pg_catalog.jsonb_typeof(p_data->'loanPayments') is distinct from 'array'
 or pg_catalog.jsonb_typeof(p_data->'snapshots') is distinct from 'array'
 or pg_catalog.octet_length(p_data::text)>3145728 then raise exception 'VAULT_INVALID'; end if;
 if pg_catalog.jsonb_array_length(p_data->'assets')>500
 or pg_catalog.jsonb_array_length(p_data->'entries')>20000
 or pg_catalog.jsonb_array_length(p_data->'loans')>1000
 or pg_catalog.jsonb_array_length(p_data->'loanPayments')>10000
 or pg_catalog.jsonb_array_length(p_data->'snapshots')>10000 then raise exception 'VAULT_INVALID'; end if;
end; $$;

create or replace function vault_private.save_workspace(p_data jsonb,p_expected bigint,p_mutation uuid,p_timezone text,p_replace boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=vault_private.require_owner(); w public.vault_workspaces%rowtype; old_request vault_private.revisions%rowtype; v_now timestamptz; v_revision bigint;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 perform vault_private.validate_data(p_data);
 if p_expected is null or p_expected<0 or p_mutation is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'VAULT_INVALID'; end if;
 select * into w from public.vault_workspaces where user_id=v_uid for update;
 select * into old_request from vault_private.revisions where user_id=v_uid and mutation_id=p_mutation;
 if old_request.revision is not null then
   if old_request.data<>p_data or w.revision<>old_request.revision then raise exception 'VAULT_CONFLICT';end if;
   return pg_catalog.jsonb_build_object('revision',w.revision,'updated_at',w.updated_at,'timezone',w.timezone);
 end if;
 if coalesce(w.revision,0)<>p_expected then raise exception 'VAULT_CONFLICT';end if;
 v_now:=pg_catalog.clock_timestamp();v_revision:=coalesce(w.revision,0)+1;
 if p_replace and w.revision is not null then
   insert into public.vault_backups(user_id,kind,backup_day,timezone,revision,data,source_saved_at,created_at)
   values(v_uid,'before-replace',(v_now at time zone w.timezone)::date,w.timezone,w.revision,w.data,w.updated_at,v_now);
 end if;
 insert into public.vault_workspaces(user_id,data,revision,timezone,created_at,updated_at)
 values(v_uid,p_data,v_revision,p_timezone,v_now,v_now)
 on conflict(user_id) do update set data=excluded.data,revision=excluded.revision,timezone=excluded.timezone,updated_at=excluded.updated_at;
 insert into vault_private.revisions(user_id,revision,mutation_id,data,created_at) values(v_uid,v_revision,p_mutation,p_data,v_now);
 return pg_catalog.jsonb_build_object('revision',v_revision,'updated_at',v_now,'timezone',p_timezone);
end; $$;

create or replace function vault_private.make_backup() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=vault_private.require_owner(); w public.vault_workspaces%rowtype; b public.vault_backups%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 select * into w from public.vault_workspaces where user_id=v_uid;
 if w.revision is null then raise exception 'VAULT_INVALID: no cloud workspace';end if;
 -- Repeated taps of the same revision in one minute do not create duplicate copies.
 select * into b from public.vault_backups where user_id=v_uid and kind='manual' and revision=w.revision and created_at>pg_catalog.now()-interval '1 minute' order by created_at desc limit 1;
 if b.id is null then
  insert into public.vault_backups(user_id,kind,backup_day,timezone,revision,data,source_saved_at)
  values(v_uid,'manual',(pg_catalog.now() at time zone w.timezone)::date,w.timezone,w.revision,w.data,w.updated_at) returning * into b;
 end if;
 return pg_catalog.jsonb_build_object('id',b.id,'revision',b.revision,'created_at',b.created_at);
end; $$;

create or replace function vault_private.restore_backup(p_backup uuid,p_expected bigint,p_mutation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=vault_private.require_owner(); w public.vault_workspaces%rowtype; b public.vault_backups%rowtype; old_request vault_private.revisions%rowtype; result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 select * into w from public.vault_workspaces where user_id=v_uid for update;
 select * into b from public.vault_backups where user_id=v_uid and id=p_backup;
 if b.id is null or w.revision is null or p_mutation is null then raise exception 'VAULT_INVALID';end if;
 select * into old_request from vault_private.revisions where user_id=v_uid and mutation_id=p_mutation;
 if old_request.revision is not null then
  if old_request.data<>b.data or w.revision<>old_request.revision then raise exception 'VAULT_CONFLICT';end if;
  return pg_catalog.jsonb_build_object('data',w.data,'revision',w.revision,'timezone',w.timezone,'updated_at',w.updated_at);
 end if;
 if w.revision<>p_expected then raise exception 'VAULT_CONFLICT';end if;
 insert into public.vault_backups(user_id,kind,backup_day,timezone,revision,data,source_saved_at)
 values(v_uid,'before-restore',(pg_catalog.now() at time zone w.timezone)::date,w.timezone,w.revision,w.data,w.updated_at);
 result:=vault_private.save_workspace(b.data,p_expected,p_mutation,w.timezone,false);
 return result||pg_catalog.jsonb_build_object('data',b.data);
end; $$;

create or replace function vault_private.status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=vault_private.require_owner(); v_last timestamptz; v_job boolean:=false; v_daily timestamptz; v_day date;
begin
 select last_success into v_last from vault_private.job_health where id;
 if pg_catalog.to_regclass('cron.job') is not null then
   execute 'select exists(select 1 from cron.job where jobname=$1 and active)' into v_job using 'vault-end-of-day';
 end if;
 select created_at,backup_day into v_daily,v_day from public.vault_backups where user_id=v_uid and kind='daily' order by backup_day desc limit 1;
 return pg_catalog.jsonb_build_object('schedulerConfigured',v_job,'lastJobSuccess',v_last,'lastDailyBackup',v_daily,'lastBackupDay',v_day,'retentionDays',90,'backupAfterMidnightMinutes',5);
end; $$;

-- The scheduler alone executes this function. No browser or Vercel secret needed.
create or replace function vault_private.run_daily_backups(p_now timestamptz default clock_timestamp()) returns integer
language plpgsql security definer set search_path='' as $$
declare w record; v_date date; v_target date; v_cutoff timestamptz; v_local timestamp; r vault_private.revisions%rowtype; v_count integer:=0; v_inserted integer;
begin
 -- Separate global lock prevents overlapping scheduler invocations.
 if not pg_catalog.pg_try_advisory_xact_lock(766827412034::bigint) then return 0;end if;
 for w in select x.* from public.vault_workspaces x join public.vault_allowed_users a on a.user_id=x.user_id loop
  v_local:=p_now at time zone w.timezone;
  v_target:=v_local::date-1;
  if v_local::time<time '00:05' then v_target:=v_target-1;end if;
  -- Catch up at most seven completed days; never invent a snapshot before first sync.
  for v_date in select (v_target-i)::date from pg_catalog.generate_series(0,6) as days(i) loop
    if exists(select 1 from public.vault_backups where user_id=w.user_id and kind='daily' and backup_day=v_date) then continue;end if;
    v_cutoff:=(v_date+1)::timestamp at time zone w.timezone;
    select * into r from vault_private.revisions where user_id=w.user_id and created_at<v_cutoff order by created_at desc,revision desc limit 1;
    if r.revision is null then continue;end if;
    insert into public.vault_backups(user_id,kind,backup_day,timezone,revision,data,source_saved_at,cutoff_at,created_at)
    values(w.user_id,'daily',v_date,w.timezone,r.revision,r.data,r.created_at,v_cutoff,p_now) on conflict do nothing;
    get diagnostics v_inserted=row_count;v_count:=v_count+v_inserted;
  end loop;
 end loop;
 delete from public.vault_backups where created_at<p_now-interval '90 days';
 -- Preserve all recent revisions AND one older baseline for accurate midnight cutoffs.
 delete from vault_private.revisions r where r.created_at<p_now-interval '8 days' and r.revision<(
  select max(z.revision) from vault_private.revisions z where z.user_id=r.user_id and z.created_at<p_now-interval '8 days'
 );
 insert into vault_private.job_health(id,last_success,backup_count)values(true,p_now,v_count)
 on conflict(id)do update set last_success=excluded.last_success,backup_count=excluded.backup_count;
 return v_count;
end; $$;

-- Exposed wrappers run as the authenticated caller. Privileged helpers are in
-- a non-exposed schema, use a pinned search_path, and authorize auth.uid().
create or replace function public.vault_save(p_data jsonb,p_expected bigint,p_mutation uuid,p_timezone text,p_replace boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select vault_private.save_workspace(p_data,p_expected,p_mutation,p_timezone,p_replace); $$;
create or replace function public.vault_make_backup() returns jsonb language sql security invoker set search_path='' as $$select vault_private.make_backup();$$;
create or replace function public.vault_restore(p_backup uuid,p_expected bigint,p_mutation uuid) returns jsonb language sql security invoker set search_path='' as $$select vault_private.restore_backup(p_backup,p_expected,p_mutation);$$;
create or replace function public.vault_status() returns jsonb language sql security invoker set search_path='' as $$select vault_private.status();$$;

revoke all on all functions in schema vault_private from public,anon,authenticated;
grant execute on function vault_private.save_workspace(jsonb,bigint,uuid,text,boolean),vault_private.make_backup(),vault_private.restore_backup(uuid,bigint,uuid),vault_private.status() to authenticated;
revoke all on function public.vault_save(jsonb,bigint,uuid,text,boolean),public.vault_make_backup(),public.vault_restore(uuid,bigint,uuid),public.vault_status() from public,anon,authenticated;
grant execute on function public.vault_save(jsonb,bigint,uuid,text,boolean),public.vault_make_backup(),public.vault_restore(uuid,bigint,uuid),public.vault_status() to authenticated;
commit;
