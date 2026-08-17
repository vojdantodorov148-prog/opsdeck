-- ============================================================
-- OPS DECK — 0003 row level security
-- Hiding a nav item is not access control. Everything sensitive
-- is enforced here as well as in the UI.
-- ============================================================

alter table profiles             enable row level security;
alter table roles                enable row level security;
alter table permissions          enable row level security;
alter table role_permissions     enable row level security;
alter table user_roles           enable row level security;
alter table brands               enable row level security;
alter table markets              enable row level security;
alter table products             enable row level security;
alter table product_links        enable row level security;
alter table product_market_tests enable row level security;
alter table tasks                enable row level security;
alter table task_deliverables    enable row level security;
alter table task_comments        enable row level security;
alter table task_reviews         enable row level security;
alter table notifications        enable row level security;
alter table activity_events      enable row level security;
alter table tools                enable row level security;
alter table notes                enable row level security;
alter table objectives           enable row level security;
alter table strategic_plans      enable row level security;
alter table brand_metrics        enable row level security;
alter table company_vision       enable row level security;
alter table xp_events            enable row level security;
alter table user_levels          enable row level security;
alter table app_settings         enable row level security;

-- ---------- reference data: any active member reads ----------
create policy p_read on profiles         for select using (is_member());
create policy p_read on roles            for select using (is_member());
create policy p_read on permissions      for select using (is_member());
create policy p_read on role_permissions for select using (is_member());
create policy p_read on user_roles       for select using (is_member());
create policy p_read on brands           for select using (is_member());
create policy p_read on markets          for select using (is_member());
create policy p_read on tools            for select using (is_member());
create policy p_read on app_settings     for select using (is_member());
create policy p_read on user_levels      for select using (is_member());

create policy p_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy p_manage on user_roles  for all using (can('team.manage'))     with check (can('team.manage'));
create policy p_manage on tools       for all using (can('tools.manage'))    with check (can('tools.manage'));
create policy p_manage on markets     for all using (can('products.manage')) with check (can('products.manage'));
create policy p_manage on brands      for all using (can('products.manage')) with check (can('products.manage'));
create policy p_manage on app_settings for all using (can('settings.manage')) with check (can('settings.manage'));

-- ---------- products ----------
create policy p_read   on products      for select using (is_member());
create policy p_manage on products      for all    using (can('products.manage')) with check (can('products.manage'));
create policy p_read   on product_links for select using (is_member());
create policy p_manage on product_links for all    using (can('products.manage')) with check (can('products.manage'));

-- ---------- testing ----------
create policy p_read   on product_market_tests for select using (is_member());
create policy p_manage on product_market_tests for all    using (can('testing.manage')) with check (can('testing.manage'));

-- ---------- tasks: the company sees company work; private tasks stay private ----------
create policy p_read on tasks for select
  using (is_member() and (not is_private or assigned_to = auth.uid() or created_by = auth.uid()));

create policy p_insert on tasks for insert
  with check (is_member() and (assigned_to = auth.uid() or can('tasks.assign')));

create policy p_update on tasks for update
  using (is_member() and (assigned_to = auth.uid() or created_by = auth.uid() or can('tasks.assign')));

create policy p_delete on tasks for delete
  using (created_by = auth.uid() or can('tasks.assign'));

create policy p_read on task_deliverables for select
  using (exists (select 1 from tasks t where t.id = task_id));
create policy p_write on task_deliverables for all
  using (exists (select 1 from tasks t where t.id = task_id
                 and (t.assigned_to = auth.uid() or t.created_by = auth.uid() or can('tasks.assign'))))
  with check (exists (select 1 from tasks t where t.id = task_id
                 and (t.assigned_to = auth.uid() or t.created_by = auth.uid() or can('tasks.assign'))));

create policy p_read   on task_comments for select using (exists (select 1 from tasks t where t.id = task_id));
create policy p_insert on task_comments for insert with check (user_id = auth.uid() and is_member());

create policy p_read  on task_reviews for select using (is_member());
create policy p_write on task_reviews for all
  using (reviewer_id = auth.uid() or can('tasks.assign'))
  with check (is_member());

-- ---------- personal streams ----------
create policy p_own on notifications for select using (user_id = auth.uid());
create policy p_own_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_read on activity_events for select using (is_member());
create policy p_own on xp_events for select using (user_id = auth.uid() or can('team.manage'));

-- ---------- notes ----------
create policy p_read on notes for select
  using (is_member() and (visibility = 'team' or author_id = auth.uid()));
create policy p_write on notes for all
  using (author_id = auth.uid()) with check (author_id = auth.uid() and is_member());

-- ---------- vision center: permission-gated at the database ----------
create policy p_read  on objectives      for select using (can('vision_center.read'));
create policy p_write on objectives      for all    using (can('vision_center.write')) with check (can('vision_center.write'));
create policy p_read  on strategic_plans for select using (can('vision_center.read'));
create policy p_write on strategic_plans for all    using (can('vision_center.write')) with check (can('vision_center.write'));
create policy p_read  on brand_metrics   for select using (can('vision_center.read'));
create policy p_write on brand_metrics   for all    using (can('vision_center.write')) with check (can('vision_center.write'));
create policy p_read  on company_vision  for select using (can('vision_center.read'));
create policy p_write on company_vision  for all    using (can('vision_center.write')) with check (can('vision_center.write'));

-- ---------- new signups become profiles automatically ----------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_member int;
begin
  insert into profiles (id, full_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  select id into v_member from roles where key = 'member';
  if v_member is not null then
    insert into user_roles (user_id, role_id) values (new.id, v_member) on conflict do nothing;
  end if;
  insert into user_levels (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();
