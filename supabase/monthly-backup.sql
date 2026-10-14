-- Run in Supabase > SQL Editor AFTER schema.sql. Replace the 3 placeholders first (marked <<...>>).

-- 1) Where the backup email address is stored (the app's Data screen writes to it)
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
drop policy if exists "team full access" on public.app_settings;
create policy "team full access" on public.app_settings for all to authenticated using (true) with check (true);

-- 2) Monthly schedule: 1st of every month, 09:00 India time (03:30 UTC)
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('conx-monthly-backup') where exists (select 1 from cron.job where jobname = 'conx-monthly-backup');
select cron.schedule('conx-monthly-backup', '30 3 1 * *', $$
  select net.http_post(
    url     := 'https://<<YOUR-PROJECT-REF>>.supabase.co/functions/v1/monthly-backup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <<YOUR-ANON-KEY>>","x-cron-secret":"<<A-LONG-RANDOM-PASSWORD>>"}'::jsonb,
    body    := '{}'::jsonb
  );
$$);
