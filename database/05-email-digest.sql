-- Assets optional daily email summary.
-- Prerequisites: run 01-schema.sql and 02-scheduler.sql first.
-- Email is intentionally opt-in. The recipient is stored inside the owner's
-- encrypted/private workspace JSON and only used when dailyEmailEnabled=true.
--
-- ONE-TIME MAIL PROVIDER SETUP (Resend example):
--   select vault.create_secret('re_REPLACE_ME','assets_resend_api_key');
--   select vault.create_secret('Assets <updates@YOUR_VERIFIED_DOMAIN>','assets_resend_from');
-- Never commit the real API key to GitHub or paste it into frontend code.

create extension if not exists pg_net;

create table if not exists vault_private.email_delivery_log(
  user_id uuid not null references auth.users(id) on delete cascade,
  report_day date not null,
  requested_at timestamptz not null default clock_timestamp(),
  request_id bigint,
  primary key(user_id,report_day)
);
alter table vault_private.email_delivery_log enable row level security;
revoke all on vault_private.email_delivery_log from public,anon,authenticated;

create or replace function vault_private.run_daily_email_summaries(p_now timestamptz default clock_timestamp())
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  w record; v_local timestamp; v_day date; v_data jsonb; v_recipient text;
  v_key text; v_from text; v_total numeric:=0; v_trade numeric:=0;
  v_borrowed numeric:=0; v_lent numeric:=0; v_net numeric:=0;
  v_html text; v_request bigint; v_count integer:=0;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(766827412035::bigint) then return 0; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name='assets_resend_api_key' limit 1;
  select decrypted_secret into v_from from vault.decrypted_secrets where name='assets_resend_from' limit 1;
  if coalesce(v_key,'')='' or coalesce(v_from,'')='' then return 0; end if;

  for w in select x.* from public.vault_workspaces x join public.vault_allowed_users a on a.user_id=x.user_id loop
    if coalesce((w.data#>>'{settings,dailyEmailEnabled}')::boolean,false) is not true then continue; end if;
    v_recipient:=btrim(coalesce(w.data#>>'{settings,dailyEmailAddress}',''));
    if v_recipient='' or position('@' in v_recipient)<2 then continue; end if;
    v_local:=p_now at time zone w.timezone;
    -- Backups begin after 00:05. Email window starts at 00:10 and is retried
    -- by the 5-minute cron until 00:34. The delivery log guarantees one/day.
    if v_local::time<time '00:10' or v_local::time>=time '00:35' then continue; end if;
    v_day:=v_local::date-1;
    if exists(select 1 from vault_private.email_delivery_log e where e.user_id=w.user_id and e.report_day=v_day) then continue; end if;

    select b.data into v_data from public.vault_backups b
      where b.user_id=w.user_id and b.kind='daily' and b.backup_day=v_day
      order by b.created_at desc limit 1;
    if v_data is null then continue; end if;

    select coalesce((x->>'value')::numeric,0) into v_total
      from jsonb_array_elements(v_data->'snapshots') x
      order by x->>'date' desc limit 1;
    v_total:=coalesce(v_total,0);

    select coalesce(sum(case when e->>'kind'='profit' then 1 else -1 end * (e->>'amount')::numeric * (e->>'fx')::numeric),0)
      into v_trade from jsonb_array_elements(v_data->'entries') e
      where e->>'date'=v_day::text and e->>'kind' in ('profit','loss');

    with loans as (
      select l->>'id' id,l->>'direction' direction,l->>'currency' currency,(l->>'openingOutstanding')::numeric opening
      from jsonb_array_elements(v_data->'loans') l
    ), paid as (
      select p->>'loanId' id,coalesce(sum((p->>'principal')::numeric),0) paid
      from jsonb_array_elements(v_data->'loanPayments') p group by p->>'loanId'
    ), outstanding as (
      select loans.direction,greatest(loans.opening-coalesce(paid.paid,0),0) *
        coalesce((v_data#>'{settings,rates}'->>loans.currency)::numeric,1) value
      from loans left join paid using(id)
    )
    select coalesce(sum(value) filter(where direction='borrowed'),0),coalesce(sum(value) filter(where direction='lent'),0)
      into v_borrowed,v_lent from outstanding;
    v_net:=v_total+v_lent-v_borrowed;

    v_html:=format('<div style="font-family:Arial,sans-serif;background:#0F0F0F;color:#fff;padding:28px;border-radius:16px"><div style="color:#5DD62C;font-size:12px;letter-spacing:1.4px">ASSETS · DAILY STATUS</div><h2 style="margin:10px 0 22px">%s</h2><table style="width:100%%;border-collapse:collapse;color:#fff"><tr><td style="padding:10px 0;color:#AAB7C4">Estimated assets</td><td style="text-align:right;font-weight:700">$%s</td></tr><tr><td style="padding:10px 0;color:#AAB7C4">Net worth</td><td style="text-align:right;font-weight:700">$%s</td></tr><tr><td style="padding:10px 0;color:#AAB7C4">Trading P&amp;L</td><td style="text-align:right;font-weight:700">%s$%s</td></tr><tr><td style="padding:10px 0;color:#AAB7C4">You owe</td><td style="text-align:right;font-weight:700">$%s</td></tr><tr><td style="padding:10px 0;color:#AAB7C4">Owed to you</td><td style="text-align:right;font-weight:700">$%s</td></tr></table><p style="margin:22px 0 0;color:#71808E;font-size:12px;line-height:1.6">This is a short status from your private Assets workspace. Values reflect the server-saved end-of-day copy and your manual conversion rates.</p></div>',v_day,to_char(v_total,'FM999999999990.00'),to_char(v_net,'FM999999999990.00'),case when v_trade>=0 then '+' else '-' end,to_char(abs(v_trade),'FM999999999990.00'),to_char(v_borrowed,'FM999999999990.00'),to_char(v_lent,'FM999999999990.00'));

    select net.http_post(
      url:='https://api.resend.com/emails',
      headers:=jsonb_build_object('Authorization','Bearer '||v_key,'Content-Type','application/json'),
      body:=jsonb_build_object('from',v_from,'to',jsonb_build_array(v_recipient),'subject','Assets daily status · '||v_day::text,'html',v_html)
    ) into v_request;
    insert into vault_private.email_delivery_log(user_id,report_day,request_id) values(w.user_id,v_day,v_request) on conflict do nothing;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function vault_private.run_daily_email_summaries(timestamptz) from public,anon,authenticated;

create extension if not exists pg_cron;
do $$begin
  if exists(select 1 from cron.job where jobname='assets-daily-email') then
    perform cron.unschedule(jobid) from cron.job where jobname='assets-daily-email';
  end if;
end$$;
select cron.schedule('assets-daily-email','*/5 * * * *',$$select vault_private.run_daily_email_summaries();$$);

select jobid,jobname,schedule,active from cron.job where jobname='assets-daily-email';
