-- ============================================================
-- OPS DECK — 0016 Secure API keys, REST API + MCP support
-- Run once after 0015_task_context_modal_and_images.sql.
-- ============================================================

-- Canonical ISO deadline for API-created tasks. Existing browser UI keeps using
-- due_date + due_time, so this is additive and does not change current behavior.
alter table public.tasks
  add column if not exists due_at timestamptz,
  add column if not exists result_folder_url text;

-- API keys are high-entropy random tokens. Only SHA-256 hashes are persisted.
create table if not exists public.api_keys (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (btrim(name) <> ''),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  key_prefix            text not null,
  key_hash              text not null unique,
  scopes                text[] not null default array['read']::text[],
  rate_limit_per_minute int not null default 60 check (rate_limit_per_minute between 1 and 1000),
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  last_used_at          timestamptz,
  revoked_at            timestamptz,
  constraint api_keys_valid_scopes check (
    scopes <@ array['read','write:products','write:tasks','write:comments']::text[]
  )
);

create index if not exists api_keys_user_idx on public.api_keys(user_id, created_at desc);
create index if not exists api_keys_active_idx on public.api_keys(revoked_at) where revoked_at is null;

-- Distributed per-key fixed-window rate limiter. Keeping this in Postgres makes
-- rate limiting work across multiple Netlify function instances.
create table if not exists public.api_rate_limit_windows (
  api_key_id    uuid not null references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null default 0 check (request_count >= 0),
  primary key (api_key_id, window_start)
);

create index if not exists api_rate_limit_window_idx
  on public.api_rate_limit_windows(window_start);

create or replace function public.consume_api_rate_limit(
  p_key_id uuid,
  p_limit int
) returns table (allowed boolean, request_count int, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('minute', clock_timestamp());
  v_count int;
begin
  insert into api_rate_limit_windows (api_key_id, window_start, request_count)
  values (p_key_id, v_window, 1)
  on conflict (api_key_id, window_start)
  do update set request_count = api_rate_limit_windows.request_count + 1
  returning api_rate_limit_windows.request_count into v_count;

  -- Cheap opportunistic cleanup; only current/recent windows are useful.
  if random() < 0.02 then
    delete from api_rate_limit_windows
    where window_start < clock_timestamp() - interval '2 hours';
  end if;

  return query
  select v_count <= greatest(coalesce(p_limit, 60), 1),
         v_count,
         v_window + interval '1 minute';
end;
$$;

revoke all on function public.consume_api_rate_limit(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(uuid, int) to service_role;

-- Idempotency records reserve a key before a POST performs a write. This blocks
-- concurrent duplicate retries as well as later retries with the same key.
create table if not exists public.api_idempotency (
  id               uuid primary key default gen_random_uuid(),
  api_key_id       uuid not null references public.api_keys(id) on delete cascade,
  idempotency_key  text not null,
  method           text not null,
  endpoint         text not null,
  request_hash     text not null,
  status_code      int,
  response_body    jsonb,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,
  unique (api_key_id, idempotency_key)
);

create index if not exists api_idempotency_created_idx
  on public.api_idempotency(created_at desc);

-- Immutable API audit trail shown to admins in Settings.
create table if not exists public.api_audit_logs (
  id                bigint generated always as identity primary key,
  api_key_id        uuid references public.api_keys(id) on delete set null,
  key_name          text not null,
  user_id           uuid references public.profiles(id) on delete set null,
  method            text not null,
  endpoint          text not null,
  status_code       int not null,
  result            text not null,
  request_id        uuid not null default gen_random_uuid(),
  duration_ms       int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists api_audit_logs_created_idx on public.api_audit_logs(created_at desc);
create index if not exists api_audit_logs_key_idx on public.api_audit_logs(api_key_id, created_at desc);

-- These tables are server-managed only. Browser clients never need direct table
-- access; the admin Settings UI talks to a Netlify function using the normal
-- Supabase browser session.
alter table public.api_keys enable row level security;
alter table public.api_rate_limit_windows enable row level security;
alter table public.api_idempotency enable row level security;
alter table public.api_audit_logs enable row level security;

-- Ensure the documented API brand enum exists without duplicating existing rows.
insert into public.brands (name, slug, active) values
  ('Alpine', 'alpine-patches', true),
  ('Origon', 'origon', true),
  ('Ветерче', 'veterce', true),
  ('Vitagen', 'vitagen', true)
on conflict (slug) do update set active = true;
