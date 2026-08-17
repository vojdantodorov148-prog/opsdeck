-- ============================================================
-- OPS DECK — 0009 Reliable team account management
-- Run once after 0008_finance_brand_drive_and_delivery_links.sql.
-- ============================================================

-- Keep all Auth users represented in the public profile table, including users
-- that were previously created manually from the Supabase dashboard.
insert into profiles (id, full_name, avatar_url, job_title, email, active)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(coalesce(u.email, 'Корисник'), '@', 1)),
  u.raw_user_meta_data->>'avatar_url',
  nullif(u.raw_user_meta_data->>'job_title', ''),
  u.email,
  true
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  full_name = case when profiles.full_name is null or profiles.full_name = '' then excluded.full_name else profiles.full_name end;

-- Every existing Auth user must have at least one application role.
insert into user_roles (user_id, role_id)
select p.id, r.id
from profiles p
join roles r on r.key = 'member'
where not exists (select 1 from user_roles ur where ur.user_id = p.id)
on conflict do nothing;

-- Explicit default page access for existing users that still rely on the old
-- implicit fallback. Once a manager edits them, these rows are overwritten.
insert into page_access (user_id, page_key, allowed)
select p.id, v.page_key, v.allowed
from profiles p
cross join (values
  ('home', true),
  ('my_day', true),
  ('tasks', true),
  ('products', true),
  ('landings', true),
  ('creatives', true),
  ('testing', true),
  ('finance', false),
  ('brands', true),
  ('tools', true),
  ('notes', true),
  ('team', true),
  ('settings', false)
) as v(page_key, allowed)
where not exists (select 1 from page_access pa where pa.user_id = p.id)
on conflict (user_id, page_key) do nothing;

-- The Auth trigger now guarantees a complete application identity for every new
-- user, whether created by OPS DECK or manually in Supabase.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_role int;
begin
  insert into profiles (id, full_name, avatar_url, job_title, email, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'Корисник'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'job_title', ''),
    new.email,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    job_title = coalesce(excluded.job_title, profiles.job_title);

  select id into member_role from roles where key = 'member';
  if member_role is not null and not exists (select 1 from user_roles where user_id = new.id) then
    insert into user_roles (user_id, role_id) values (new.id, member_role)
    on conflict do nothing;
  end if;

  insert into user_levels (user_id) values (new.id)
  on conflict (user_id) do nothing;

  -- Explicit default access. The Netlify team-user function replaces these rows
  -- immediately with the pages selected by the owner/admin.
  insert into page_access (user_id, page_key, allowed) values
    (new.id, 'home', true),
    (new.id, 'my_day', true),
    (new.id, 'tasks', true),
    (new.id, 'products', true),
    (new.id, 'landings', true),
    (new.id, 'creatives', true),
    (new.id, 'testing', true),
    (new.id, 'finance', false),
    (new.id, 'brands', true),
    (new.id, 'tools', true),
    (new.id, 'notes', true),
    (new.id, 'team', true),
    (new.id, 'settings', false)
  on conflict (user_id, page_key) do nothing;

  return new;
end;
$$;

-- Recreate the trigger to guarantee that the latest function is attached.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- Let a logged-in user's UI react immediately when an owner/admin changes their
-- role or page access.
do $$
declare t text;
begin
  foreach t in array array['page_access','user_roles'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Keep the API surface explicit for the server-side team manager function.
revoke all on function has_permission(uuid, text) from anon;
grant execute on function has_permission(uuid, text) to authenticated, service_role;
