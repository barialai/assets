-- Run AFTER 01-schema.sql. This is the actual server-side scheduler installation.
-- In Supabase, enable Cron in Integrations if pg_cron is not enabled yet.
create extension if not exists pg_cron;
select cron.schedule('vault-end-of-day','*/5 * * * *','select vault_private.run_daily_backups();');
-- Confirm execution immediately. An empty workspace creates no financial backup.
select vault_private.run_daily_backups();
-- Optional: inspect scheduler results, without opening the website.
select jobid,jobname,schedule,active from cron.job where jobname='vault-end-of-day';
-- Daily copies cover the completed local day, using the LAST SERVER-SAVED
-- revision before midnight. The 00:05 run leaves time for the date to roll over.
-- Offline/unsent edits cannot appear in that historical cutoff; they sync later.
-- This job also retains 90 days of backups and at least 8 days of revision data.
