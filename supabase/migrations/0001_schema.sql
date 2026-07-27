-- ============================================================
-- OPS DECK — 0001 schema
-- ============================================================
create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type product_status      as enum ('research','approved','active','paused','archived');
create type market_test_status  as enum ('not_tested','planned','preparing','ready','testing','winner','stopped');
create type task_status         as enum ('todo','doing','blocked','review','done');
create type task_source         as enum ('manual','quick_action','workflow','review','personal');
create type department          as enum ('landing','creative','testing','general');
create type deliverable_status  as enum ('todo','doing','done');
create type review_status       as enum ('pending','approved','changes_requested');
create type note_visibility     as enum ('private','team');
create type plan_horizon        as enum ('now','next','later');
create type objective_status    as enum ('planned','active','at_risk','done');
create type notification_type   as enum ('new_assignment','review_needed','decision_needed','task_blocked','mention');

-- deliverable types drive automatic routing (see 0002 fn_department_for_deliverable)
create type deliverable_type as enum (
  'product_page','advertorial','listicle','quiz','landing_localization','other_landing',
  'static_ad','video_ad','ugc','creative_concept','image_variation','hook_variation','creative_localization','other_creative',
  'research','campaign','general_task','custom'
);

-- ---------- identity ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  avatar_url  text,
  job_title   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table roles (
  id    serial primary key,
  key   text unique not null,          -- owner | admin | manager | member
  label text not null,
  rank  int  not null                  -- higher = more authority
);

create table permissions (
  key   text primary key,              -- e.g. vision_center.read
  label text not null
);

create table role_permissions (
  role_id        int  references roles(id) on delete cascade,
  permission_key text references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table user_roles (
  user_id uuid references profiles(id) on delete cascade,
  role_id int  references roles(id)    on delete cascade,
  primary key (user_id, role_id)
);

-- ---------- catalogue ----------
create table brands (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  slug     text unique not null,
  logo_url text,
  active   boolean not null default true
);

create table markets (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,      -- HR, BG, HU ...
  name       text not null,
  currency   text not null default 'EUR',
  active     boolean not null default true,
  sort_order int not null default 0
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid references brands(id) on delete set null,
  name           text not null,
  sku            text,
  selling_price  numeric(12,2),
  currency       text not null default 'EUR',
  break_even_cpa numeric(12,2),
  cogs           numeric(12,2),
  status         product_status not null default 'research',
  main_url       text,
  supplier_url   text,
  assets_url     text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table product_links (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  label      text not null,
  url        text not null,
  sort_order int not null default 0
);

-- ---------- product x market testing ----------
create table product_market_tests (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  market_id    uuid not null references markets(id)  on delete cascade,
  status       market_test_status not null default 'not_tested',
  owner_id     uuid references profiles(id) on delete set null,
  planned_date date,
  start_date   date,
  end_date     date,
  landing_url  text,
  campaign_url text,
  offer        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, market_id)
);

-- ---------- work ----------
create table tasks (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  description            text,
  created_by             uuid references profiles(id) on delete set null,
  assigned_to            uuid references profiles(id) on delete set null,
  product_id             uuid references products(id) on delete set null,
  market_id              uuid references markets(id)  on delete set null,
  department             department not null default 'general',
  status                 task_status not null default 'todo',
  priority               int,
  due_date               date,
  scheduled_date         date,
  scheduled_time         time,
  sort_order             int not null default 0,
  source                 task_source not null default 'manual',
  parent_task_id         uuid references tasks(id) on delete cascade,
  product_market_test_id uuid references product_market_tests(id) on delete set null,
  is_private             boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  completed_at           timestamptz
);

create table task_deliverables (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references tasks(id) on delete cascade,
  type               deliverable_type not null,
  quantity           int not null default 1 check (quantity > 0),
  completed_quantity int not null default 0 check (completed_quantity >= 0),
  status             deliverable_status not null default 'todo',
  url                text,
  notes              text,
  sort_order         int not null default 0
);

create table task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid references profiles(id) on delete set null,
  content    text not null,
  created_at timestamptz not null default now()
);

create table task_reviews (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  reviewer_id uuid references profiles(id) on delete set null,
  status      review_status not null default 'pending',
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- signal ----------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  message     text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table activity_events (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  event_type  text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- surroundings ----------
create table tools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  url         text not null,
  icon        text,
  category    text not null default 'work',
  favorite    boolean not null default false,
  visibility  text not null default 'team',
  sort_order  int not null default 0,
  active      boolean not null default true
);

create table notes (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references profiles(id) on delete set null,
  title      text,
  content    text not null,
  visibility note_visibility not null default 'private',
  product_id uuid references products(id) on delete cascade,
  market_id  uuid references markets(id)  on delete cascade,
  task_id    uuid references tasks(id)    on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- vision center (restricted) ----------
create table objectives (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid references brands(id) on delete cascade,
  title         text not null,
  description   text,
  status        objective_status not null default 'active',
  progress      int not null default 0 check (progress between 0 and 100),
  target_value  numeric,
  current_value numeric,
  target_date   date,
  owner_id      uuid references profiles(id) on delete set null,
  sort_order    int not null default 0
);

create table strategic_plans (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid references brands(id) on delete cascade,
  horizon     plan_horizon not null,
  title       text not null,
  description text,
  sort_order  int not null default 0
);

create table brand_metrics (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  revenue      numeric,
  profit       numeric,
  ad_spend     numeric,
  metadata     jsonb not null default '{}'::jsonb,
  unique (brand_id, period_start, period_end)
);

create table company_vision (
  id          int primary key default 1 check (id = 1),
  north_star  text,
  updated_at  timestamptz not null default now()
);

-- ---------- gamification ----------
create table xp_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  amount      int not null,
  reason      text not null,
  entity_type text,
  entity_id   uuid,
  created_at  timestamptz not null default now()
);

create table user_levels (
  user_id    uuid primary key references profiles(id) on delete cascade,
  total_xp   int not null default 0,
  level      int not null default 1,
  updated_at timestamptz not null default now()
);

create table app_settings (
  key   text primary key,
  value jsonb not null
);

-- ---------- indexes ----------
create index idx_tasks_assigned      on tasks(assigned_to, status);
create index idx_tasks_scheduled     on tasks(assigned_to, scheduled_date);
create index idx_tasks_department    on tasks(department, status);
create index idx_tasks_product       on tasks(product_id);
create index idx_tasks_market        on tasks(market_id);
create index idx_deliverables_task   on task_deliverables(task_id);
create index idx_comments_task       on task_comments(task_id);
create index idx_reviews_task        on task_reviews(task_id, status);
create index idx_notif_user_unread   on notifications(user_id, read_at);
create index idx_activity_created    on activity_events(created_at desc);
create index idx_pmt_product         on product_market_tests(product_id);
create index idx_pmt_status          on product_market_tests(status);
create index idx_notes_author        on notes(author_id, created_at desc);
create index idx_xp_user             on xp_events(user_id, created_at desc);
