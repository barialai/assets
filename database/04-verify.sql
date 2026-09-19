-- Read-only configuration checks. Does not expose balances, photos or records.
select tablename,rowsecurity from pg_catalog.pg_tables
where schemaname='public' and tablename in ('vault_allowed_users','vault_workspaces','vault_backups');
select count(*) as authorized_owner_count from public.vault_allowed_users;
select has_table_privilege('anon','public.vault_workspaces','SELECT') as anon_can_read_workspaces,
       has_table_privilege('anon','public.vault_backups','SELECT') as anon_can_read_backups,
       has_table_privilege('authenticated','public.vault_workspaces','UPDATE') as user_can_bypass_save_function;
-- All three privileges above should be FALSE. RLS on the public tables is TRUE.
select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('vault_save','vault_restore','vault_status','vault_make_backup'))
   or (n.nspname='vault_private');
-- Run the following only after installing 02-scheduler.sql:
select jobid,jobname,schedule,active from cron.job where jobname='vault-end-of-day';
select r.status,r.start_time,r.end_time,r.return_message from cron.job_run_details r
join cron.job j using(jobid) where j.jobname='vault-end-of-day' order by r.start_time desc limit 10;
select last_success,backup_count from vault_private.job_health where id;
