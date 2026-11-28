-- GA 8D Report: shared storage on Supabase, opened with a team link (no email, no password).
-- Run this whole file once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- The last line prints your TEAM KEY. Keep it: the team link is the site address plus ?team=<key>.
-- Safe to run again; it keeps the existing key and data.

-- 1. The team key. Only people who opened the site through a link with this key can see or change anything.
--    Nobody can read this table from the website; it is checked inside the database only.
create table if not exists public.ga8d_settings (
  id       int primary key default 1 check (id = 1),
  team_key text not null default replace(gen_random_uuid()::text, '-', '')
);
insert into public.ga8d_settings (id) values (1) on conflict (id) do nothing;
alter table public.ga8d_settings enable row level security;   -- no policies: unreadable from outside

-- 2. Who has joined with the key (one row per browser that opened the team link).
create table if not exists public.ga8d_members (
  uid       uuid primary key references auth.users on delete cascade,
  joined_at timestamptz not null default now()
);
alter table public.ga8d_members enable row level security;    -- no policies: unreadable from outside

create or replace function public.ga8d_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ga8d_members where uid = auth.uid())
$$;

create or replace function public.ga8d_join(p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_key is null or p_key <> (select team_key from public.ga8d_settings where id = 1) then
    return false;
  end if;
  insert into public.ga8d_members (uid) values (auth.uid()) on conflict (uid) do nothing;
  return true;
end $$;

revoke all on function public.ga8d_member() from public, anon;
revoke all on function public.ga8d_join(text) from public, anon;
grant execute on function public.ga8d_member() to authenticated;
grant execute on function public.ga8d_join(text) to authenticated;

-- 3. Reports: one row per 8D, the whole report kept as JSON.
create table if not exists public.reports (
  id         text primary key check (id ~ '^[a-z0-9]{6,40}$'),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "ga8d members read"   on public.reports;
drop policy if exists "ga8d members insert" on public.reports;
drop policy if exists "ga8d members update" on public.reports;
drop policy if exists "ga8d members delete" on public.reports;
create policy "ga8d members read"   on public.reports for select to authenticated using (public.ga8d_member());
create policy "ga8d members insert" on public.reports for insert to authenticated with check (public.ga8d_member());
create policy "ga8d members update" on public.reports for update to authenticated using (public.ga8d_member()) with check (public.ga8d_member());
create policy "ga8d members delete" on public.reports for delete to authenticated using (public.ga8d_member());

-- 4. Saving a change merges it into the stored report on the server, so two people
--    editing different parts of the same 8D at the same time do not overwrite each other.
--    Objects merge key by key; anything else (text, lists) is replaced.
create or replace function public.ga8d_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; r jsonb;
begin
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(b) is distinct from 'object' then
    return b;
  end if;
  r := a;
  for k in select jsonb_object_keys(b) loop
    r := jsonb_set(r, array[k], case when r ? k then public.ga8d_merge(r -> k, b -> k) else b -> k end, true);
  end loop;
  return r;
end $$;

create or replace function public.ga8d_patch(p_id text, p_patch jsonb) returns boolean
language plpgsql security invoker as $$
begin
  update public.reports set data = public.ga8d_merge(data, p_patch), updated_at = now() where id = p_id;
  return found;
end $$;
revoke all on function public.ga8d_patch(text, jsonb) from public, anon;
grant execute on function public.ga8d_patch(text, jsonb) to authenticated;

-- 5. Names shown in the app ("Opened by", owners, history). Optional: each person can add theirs from the bar.
create table if not exists public.profiles (
  id    uuid primary key references auth.users on delete cascade,
  name  text not null default '',
  email text not null default ''
);
alter table public.profiles enable row level security;
drop policy if exists "ga8d profiles read"   on public.profiles;
drop policy if exists "ga8d profiles insert" on public.profiles;
drop policy if exists "ga8d profiles update" on public.profiles;
create policy "ga8d profiles read"   on public.profiles for select to authenticated using (public.ga8d_member());
create policy "ga8d profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid() and public.ga8d_member());
create policy "ga8d profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 5b. Let signed-in browsers reach these tables at all (newer Supabase projects no longer grant this
--     automatically). What each one may actually see or change is still decided by the policies above.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.reports  to authenticated;
grant select, insert, update         on public.profiles to authenticated;
revoke all on public.ga8d_settings, public.ga8d_members from anon, authenticated;

-- 6. Live updates: everyone with the page open sees changes as they are saved.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports') then
    alter publication supabase_realtime add table public.reports;
  end if;
end $$;

-- 7. Attachments: a private bucket, 20 MB per file. Only members can read, add or remove files.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 20971520)
on conflict (id) do nothing;
drop policy if exists "ga8d files read"   on storage.objects;
drop policy if exists "ga8d files add"    on storage.objects;
drop policy if exists "ga8d files remove" on storage.objects;
create policy "ga8d files read"   on storage.objects for select to authenticated using (bucket_id = 'attachments' and public.ga8d_member());
create policy "ga8d files add"    on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and public.ga8d_member());
create policy "ga8d files remove" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and public.ga8d_member());

-- 8. Your team key. The team link is: https://<your site>/?team=<this key>
select team_key as "Your team key" from public.ga8d_settings where id = 1;

-- To lock everyone out later (for example if the link was posted somewhere public), run these two lines,
-- then send the team the new link:
--   update public.ga8d_settings set team_key = replace(gen_random_uuid()::text, '-', '') where id = 1;
--   delete from public.ga8d_members;
