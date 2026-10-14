-- Conx Ops: run this once in Supabase > SQL Editor > New query > Run.

create table if not exists public.records (
  kind        text        not null check (kind in ('contracts','clients','tickets','reports')),
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (kind, id)
);

-- Only signed-in users (your team) can read or write anything.
alter table public.records enable row level security;
drop policy if exists "team full access" on public.records;
create policy "team full access" on public.records
  for all to authenticated using (true) with check (true);

-- Live sync between devices
alter table public.records replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;

-- Service report numbers: atomic, never duplicated, continues from the highest existing (starts at 701)
create table if not exists public.counters (name text primary key, value bigint not null);
insert into public.counters(name, value) values ('serial', 700) on conflict do nothing;
alter table public.counters enable row level security;  -- no policies: only the function below touches it

create or replace function public.next_serial() returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  update public.counters c
     set value = greatest(c.value, coalesce((
           select max((r.data->>'serialNo')::bigint) from public.records r
            where r.kind = 'reports' and r.data->>'serialNo' ~ '^[0-9]+$'), 700)) + 1
   where c.name = 'serial'
   returning c.value into v;
  return v;
end $$;
revoke all on function public.next_serial() from public, anon;
grant execute on function public.next_serial() to authenticated;

-- Starting clients (safe to run twice)
insert into public.records(kind, id, data) values
 ('clients','seed-voya','{"id":"seed-voya","name":"Voya","contactPerson":"","phone":"","email":"","sites":"Multiple Bangalore & Hyderabad locations"}'),
 ('clients','seed-qualitest','{"id":"seed-qualitest","name":"Qualitest","contactPerson":"","phone":"","email":"","sites":"Coimbatore"}')
on conflict do nothing;
