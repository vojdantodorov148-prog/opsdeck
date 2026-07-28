-- ============================================================
-- OPS DECK — 0005 Macedonian UI support, page access and text editing
-- Run once after 0004_seed.sql.
-- ============================================================

alter table profiles add column if not exists email text;

update profiles p set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Per-user visibility for application pages. Owners/admins bypass this in the UI,
-- while the table lets team managers choose exactly what each other account sees.
create table if not exists page_access (
  user_id    uuid not null references profiles(id) on delete cascade,
  page_key   text not null,
  allowed    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, page_key)
);

-- Editable interface copy. The tiny pencil in the UI stores overrides here.
create table if not exists app_texts (
  key          text primary key,
  value        text not null,
  original     text,
  updated_by   uuid references profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);

alter table page_access enable row level security;
alter table app_texts enable row level security;

-- Policies are recreated idempotently so this migration can safely be retried.
drop policy if exists p_page_access_read on page_access;
create policy p_page_access_read on page_access for select
  using (user_id = auth.uid() or can('team.manage'));

drop policy if exists p_page_access_manage on page_access;
create policy p_page_access_manage on page_access for all
  using (can('team.manage'))
  with check (can('team.manage'));

drop policy if exists p_app_texts_read on app_texts;
create policy p_app_texts_read on app_texts for select
  using (is_member());

drop policy if exists p_app_texts_manage on app_texts;
create policy p_app_texts_manage on app_texts for all
  using (can('settings.manage'))
  with check (can('settings.manage'));

-- Team managers may update profile display fields from the Team page.
drop policy if exists p_team_update on profiles;
create policy p_team_update on profiles for update
  using (can('team.manage'))
  with check (can('team.manage'));

-- Add the Marketing Intelligence link while preserving an existing calendar URL.
insert into app_settings (key, value)
values (
  'external_apps',
  jsonb_build_object(
    'creative_testing_calendar', 'https://example.com/creative-testing-calendar',
    'marketing_intelligence', 'https://marketron-mi.pages.dev/#operator'
  )
)
on conflict (key) do update
set value = jsonb_set(
  coalesce(app_settings.value, '{}'::jsonb),
  '{marketing_intelligence}',
  '"https://marketron-mi.pages.dev/#operator"'::jsonb,
  true
);

-- Keep profile email synchronized for every future account created in Supabase.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare member_role int;
begin
  insert into profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Корисник'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do update set email = excluded.email;

  select id into member_role from roles where key = 'member';
  if member_role is not null then
    insert into user_roles (user_id, role_id) values (new.id, member_role)
    on conflict do nothing;
  end if;
  insert into user_levels (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- Macedonian notification copy for new assignments.
create or replace function trg_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into notifications (user_id, type, title, message, entity_type, entity_id)
    values (
      new.assigned_to,
      'new_assignment',
      new.title,
      'Доделено од ' || coalesce((select full_name from profiles where id = new.created_by), 'OPS DECK'),
      'task',
      new.id
    );
  end if;

  if tg_op = 'INSERT' then
    insert into activity_events (actor_id, event_type, entity_type, entity_id, metadata)
    values (new.created_by, 'task.created', 'task', new.id,
            jsonb_build_object('title', new.title, 'department', new.department));
  end if;
  return new;
end;
$$;

-- Macedonian completion/review messages.
create or replace function trg_task_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_xp int; v_units int;
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
    select coalesce(sum(quantity),0) into v_units from task_deliverables where task_id = new.id;
    v_xp := coalesce((select (value->>'task_complete')::int from app_settings where key = 'xp'), 10)
          + greatest(v_units - 1, 0) * coalesce((select (value->>'per_deliverable')::int from app_settings where key = 'xp'), 20);

    if new.assigned_to is not null then
      insert into xp_events (user_id, amount, reason, entity_type, entity_id)
      values (new.assigned_to, v_xp, 'task_completed', 'task', new.id);
    end if;

    insert into activity_events (actor_id, event_type, entity_type, entity_id, metadata)
    values (new.assigned_to, 'task.completed', 'task', new.id, jsonb_build_object('title', new.title));

    if new.created_by is not null and new.created_by <> new.assigned_to then
      insert into notifications (user_id, type, title, message, entity_type, entity_id)
      values (new.created_by, 'review_needed', new.title, 'Означено како завршено', 'task', new.id);
    end if;
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function trg_review_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and new.reviewer_id is not null then
    insert into notifications (user_id, type, title, message, entity_type, entity_id)
    values (
      new.reviewer_id,
      'review_needed',
      (select title from tasks where id = new.task_id),
      'Испратено на преглед',
      'task',
      new.task_id
    );
  end if;
  return new;
end;
$$;

-- Branding can be changed from Settings without another code deployment.
insert into app_settings (key, value)
values ('branding', '{"logo_url": null}'::jsonb)
on conflict (key) do nothing;

-- Translate the standard seeded market and tool copy without touching custom records.
update markets set name = case code
  when 'MK' then 'Северна Македонија'
  when 'HR' then 'Хрватска'
  when 'BG' then 'Бугарија'
  when 'HU' then 'Унгарија'
  when 'RO' then 'Романија'
  when 'SI' then 'Словенија'
  else name end
where code in ('MK','HR','BG','HU','RO','SI');

update tools set description = case name
  when 'Ad Creator' then 'Креирање варијации на реклами'
  when 'Ad Cloner' then 'Пресликување победнички визуали на нови производи'
  when 'Ad Localizer' then 'Превод и адаптација на креативи'
  when 'Landing IMG Creator' then 'Креирање слики за лендинг страници'
  when 'Meta Ads' then 'Управување со кампањи'
  when 'Shopify' then 'Продавници и нарачки'
  when 'Google Drive' then 'Фајлови и материјали'
  when 'Google Sheets' then 'Табели и податоци'
  when 'Canva' then 'Дизајн'
  when 'Creative Testing Calendar' then 'Концепти, хукови и агли'
  when 'TrendTrack' then 'Истражување производи'
  when 'Market Research' then 'Белешки и извори за пазари'
  else description end
where name in ('Ad Creator','Ad Cloner','Ad Localizer','Landing IMG Creator','Meta Ads','Shopify','Google Drive','Google Sheets','Canva','Creative Testing Calendar','TrendTrack','Market Research');

-- Translate already-created standard notifications as well.
update notifications
set message = 'Доделено од ' || substring(message from char_length('Assigned by ') + 1)
where message like 'Assigned by %';

update notifications set message = 'Означено како завршено' where message = 'Marked done';
update notifications set message = 'Испратено на преглед' where message = 'Submitted for review';
