-- ============================================================
-- OPS DECK — 0018 Telegram task notifications
-- Adds per-user Telegram connections and a reliable delivery outbox.
-- The Telegram bot token remains in Netlify env; it is never stored in Postgres.
-- ============================================================

create table if not exists public.telegram_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  chat_id bigint not null unique,
  telegram_username text,
  telegram_first_name text,
  active boolean not null default true,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists telegram_link_codes_user_idx
  on public.telegram_link_codes(user_id, created_at desc);
create index if not exists telegram_link_codes_active_idx
  on public.telegram_link_codes(code, expires_at)
  where used_at is null;

create table if not exists public.telegram_notification_outbox (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_outbox_pending_idx
  on public.telegram_notification_outbox(state, next_attempt_at, created_at);

alter table public.telegram_connections enable row level security;
alter table public.telegram_link_codes enable row level security;
alter table public.telegram_notification_outbox enable row level security;

-- Intentionally no browser-facing RLS policies. These tables are managed only by
-- service-role Netlify functions. This keeps chat IDs and pairing codes server-only.

create or replace function public.trg_telegram_queue_new_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'new_assignment'
     and new.entity_type = 'task'
     and new.entity_id is not null
     and exists (
       select 1 from telegram_connections c
       where c.user_id = new.user_id and c.active = true
     ) then
    insert into telegram_notification_outbox(notification_id, user_id, task_id)
    values (new.id, new.user_id, new.entity_id)
    on conflict (notification_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists telegram_queue_new_assignment on public.notifications;
create trigger telegram_queue_new_assignment
after insert on public.notifications
for each row execute function public.trg_telegram_queue_new_assignment();

create or replace function public.claim_telegram_notification_outbox(p_limit integer default 20)
returns setof public.telegram_notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select o.notification_id
    from telegram_notification_outbox o
    where o.state in ('pending','failed')
      and o.next_attempt_at <= now()
      and o.attempts < 8
    order by o.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update telegram_notification_outbox o
     set state = 'sending',
         attempts = o.attempts + 1,
         updated_at = now()
    from picked
   where o.notification_id = picked.notification_id
  returning o.*;
end;
$$;

revoke all on function public.claim_telegram_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_telegram_notification_outbox(integer) to service_role;

create or replace function public.requeue_telegram_notification(
  p_notification_id uuid,
  p_error text,
  p_delay_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update telegram_notification_outbox
     set state = 'failed',
         last_error = left(coalesce(p_error, 'Telegram delivery failed.'), 2000),
         next_attempt_at = now() + make_interval(secs => greatest(15, least(coalesce(p_delay_seconds, 60), 3600))),
         updated_at = now()
   where notification_id = p_notification_id;
end;
$$;

revoke all on function public.requeue_telegram_notification(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.requeue_telegram_notification(uuid, text, integer) to service_role;

create or replace function public.complete_telegram_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update telegram_notification_outbox
     set state = 'sent',
         sent_at = now(),
         last_error = null,
         updated_at = now()
   where notification_id = p_notification_id;
end;
$$;

revoke all on function public.complete_telegram_notification(uuid) from public, anon, authenticated;
grant execute on function public.complete_telegram_notification(uuid) to service_role;
