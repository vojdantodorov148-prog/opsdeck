-- ============================================================
-- OPS DECK — 0012 dedicated market field + simplified Finance
-- Run once after 0011_task_assignment_and_completion_guard.sql.
-- ============================================================

-- -----------------------------------------------------------------
-- 1) Task titles no longer carry the market name. Market remains a
--    first-class relation and is displayed in its own UI field.
-- -----------------------------------------------------------------
update public.tasks t
set title = p.name || case t.department
  when 'landing' then ' · Лендинг'
  when 'creative' then ' · Креативи'
  when 'testing' then ' · Тестирање'
  else ''
end,
updated_at = now()
from public.products p
where t.product_id = p.id
  and t.source = 'quick_action';

-- -----------------------------------------------------------------
-- 2) Finance V2 — intentionally small: accounts, account change log,
--    transactions, and recurring rules.
-- -----------------------------------------------------------------
create table if not exists public.finance_accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric(14,2) not null default 0,
  currency    text not null default 'EUR',
  notes       text,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.finance_recurring_rules (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.finance_accounts(id) on delete cascade,
  kind          text not null check (kind in ('income','expense')),
  description   text not null,
  amount        numeric(14,2) not null check (amount > 0),
  currency      text not null default 'EUR',
  cadence       text not null check (cadence in ('weekly','monthly','yearly')),
  next_run_date date not null,
  active        boolean not null default true,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id                  uuid primary key default gen_random_uuid(),
  transaction_date    date not null default current_date,
  kind                text not null check (kind in ('income','expense')),
  description         text not null,
  amount              numeric(14,2) not null check (amount > 0),
  currency            text not null default 'EUR',
  account_id          uuid not null references public.finance_accounts(id) on delete restrict,
  notes               text,
  recurring_rule_id   uuid references public.finance_recurring_rules(id) on delete set null,
  recurrence_date     date,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (recurring_rule_id, recurrence_date)
);

create table if not exists public.finance_account_logs (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.finance_accounts(id) on delete cascade,
  change_type     text not null check (change_type in ('created','manual','transaction','archived')),
  old_amount      numeric(14,2),
  new_amount      numeric(14,2) not null,
  delta           numeric(14,2) not null default 0,
  note            text,
  transaction_id  uuid references public.finance_entries(id) on delete set null,
  changed_by      uuid references public.profiles(id) on delete set null,
  changed_at      timestamptz not null default now()
);

create index if not exists finance_accounts_active_idx on public.finance_accounts(active, name);
create index if not exists finance_entries_date_idx on public.finance_entries(transaction_date desc, created_at desc);
create index if not exists finance_entries_account_idx on public.finance_entries(account_id, transaction_date desc);
create index if not exists finance_account_logs_account_idx on public.finance_account_logs(account_id, changed_at desc);
create index if not exists finance_recurring_due_idx on public.finance_recurring_rules(active, next_run_date);

-- Preserve any capital accounts already entered in the old Finance page.
insert into public.finance_accounts (id, name, amount, currency, notes, created_by, created_at, updated_at)
select id, name, amount, currency, notes, updated_by, created_at, updated_at
from public.capital_accounts
on conflict (id) do nothing;

-- Brand-new installations get the three accounts requested by the owner.
insert into public.finance_accounts (name, amount, currency, notes)
select v.name, 0, 'EUR', v.notes
from (values
  ('Кеш', 'Готовина'),
  ('ProCredit', 'ProCredit Bank'),
  ('Mercury', 'Mercury')
) as v(name, notes)
where not exists (
  select 1 from public.finance_accounts a
  where a.active and lower(a.name) = lower(v.name)
);

-- Initial history rows for accounts that do not have a log yet.
insert into public.finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, changed_by)
select a.id, 'created', null, a.amount, a.amount, 'Почетна состојба', a.created_by
from public.finance_accounts a
where not exists (select 1 from public.finance_account_logs l where l.account_id = a.id);

-- -----------------------------------------------------------------
-- Helpers / RPCs
-- -----------------------------------------------------------------
create or replace function public.finance_next_date(p_date date, p_cadence text)
returns date
language sql
immutable
as $$
  select case p_cadence
    when 'weekly' then (p_date + interval '7 days')::date
    when 'yearly' then (p_date + interval '1 year')::date
    else (p_date + interval '1 month')::date
  end;
$$;

create or replace function public.create_finance_account(
  p_name text,
  p_amount numeric default 0,
  p_currency text default 'EUR',
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_amount numeric := coalesce(p_amount, 0);
begin
  if not can('finance.manage') then raise exception 'not authorised'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Името на сметката е задолжително'; end if;

  insert into finance_accounts (name, amount, currency, notes, created_by)
  values (trim(p_name), v_amount, upper(coalesce(nullif(trim(p_currency), ''), 'EUR')), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;

  insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, changed_by)
  values (v_id, 'created', null, v_amount, v_amount, 'Сметката е креирана', auth.uid());

  return v_id;
end;
$$;

create or replace function public.update_finance_account(
  p_account_id uuid,
  p_name text,
  p_amount numeric,
  p_currency text,
  p_notes text default null,
  p_log_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric;
  v_new numeric := coalesce(p_amount, 0);
begin
  if not can('finance.manage') then raise exception 'not authorised'; end if;

  select amount into v_old from finance_accounts where id = p_account_id and active for update;
  if not found then raise exception 'Сметката не постои'; end if;

  update finance_accounts
  set name = trim(p_name),
      amount = v_new,
      currency = upper(coalesce(nullif(trim(p_currency), ''), 'EUR')),
      notes = nullif(trim(p_notes), ''),
      updated_at = now()
  where id = p_account_id;

  if v_old is distinct from v_new then
    insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, changed_by)
    values (p_account_id, 'manual', v_old, v_new, v_new - v_old,
            coalesce(nullif(trim(p_log_note), ''), 'Рачно ажурирање на капитал'), auth.uid());
  end if;
end;
$$;

create or replace function public.archive_finance_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_has_entries boolean;
begin
  if not can('finance.manage') then raise exception 'not authorised'; end if;

  select amount into v_amount from finance_accounts where id = p_account_id and active for update;
  if not found then raise exception 'Сметката не постои'; end if;
  if v_amount <> 0 then raise exception 'За да ја тргнеш сметката, прво постави го салдото на 0'; end if;

  select exists(select 1 from finance_entries where account_id = p_account_id) into v_has_entries;
  if v_has_entries then
    update finance_accounts set active = false, updated_at = now() where id = p_account_id;
    update finance_recurring_rules set active = false, updated_at = now() where account_id = p_account_id;
    insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, changed_by)
    values (p_account_id, 'archived', 0, 0, 0, 'Сметката е тргната од активни сметки', auth.uid());
  else
    delete from finance_account_logs where account_id = p_account_id;
    delete from finance_accounts where id = p_account_id;
  end if;
end;
$$;

-- Apply / reverse transactions and keep a full balance history.
create or replace function public.trg_finance_entry_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_balance numeric;
  v_new_balance numeric;
  v_delta numeric;
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    v_delta := case when new.kind = 'income' then new.amount else -new.amount end;
    select amount into v_old_balance from finance_accounts where id = new.account_id for update;
    if not found then raise exception 'Сметката не постои'; end if;
    v_new_balance := v_old_balance + v_delta;
    update finance_accounts set amount = v_new_balance, updated_at = now() where id = new.account_id;
    insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, transaction_id, changed_by)
    values (new.account_id, 'transaction', v_old_balance, v_new_balance, v_delta, new.description, new.id, coalesce(v_actor, new.created_by));
    return new;
  elsif tg_op = 'DELETE' then
    v_delta := case when old.kind = 'income' then -old.amount else old.amount end;
    select amount into v_old_balance from finance_accounts where id = old.account_id for update;
    if found then
      v_new_balance := v_old_balance + v_delta;
      update finance_accounts set amount = v_new_balance, updated_at = now() where id = old.account_id;
      insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, transaction_id, changed_by)
      values (old.account_id, 'transaction', v_old_balance, v_new_balance, v_delta, 'Избришана трансакција: ' || old.description, null, coalesce(v_actor, old.created_by));
    end if;
    return old;
  else
    -- Updates are rare, but remain mathematically correct: reverse OLD, apply NEW.
    if old.account_id = new.account_id then
      v_delta := (case when new.kind = 'income' then new.amount else -new.amount end)
                 - (case when old.kind = 'income' then old.amount else -old.amount end);
      if v_delta <> 0 then
        select amount into v_old_balance from finance_accounts where id = new.account_id for update;
        v_new_balance := v_old_balance + v_delta;
        update finance_accounts set amount = v_new_balance, updated_at = now() where id = new.account_id;
        insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, transaction_id, changed_by)
        values (new.account_id, 'transaction', v_old_balance, v_new_balance, v_delta, 'Изменета трансакција: ' || new.description, new.id, coalesce(v_actor, new.created_by));
      end if;
    else
      -- Reverse old account.
      v_delta := case when old.kind = 'income' then -old.amount else old.amount end;
      select amount into v_old_balance from finance_accounts where id = old.account_id for update;
      v_new_balance := v_old_balance + v_delta;
      update finance_accounts set amount = v_new_balance, updated_at = now() where id = old.account_id;
      insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, transaction_id, changed_by)
      values (old.account_id, 'transaction', v_old_balance, v_new_balance, v_delta, 'Трансакцијата е префрлена на друга сметка', new.id, coalesce(v_actor, new.created_by));

      -- Apply new account.
      v_delta := case when new.kind = 'income' then new.amount else -new.amount end;
      select amount into v_old_balance from finance_accounts where id = new.account_id for update;
      v_new_balance := v_old_balance + v_delta;
      update finance_accounts set amount = v_new_balance, updated_at = now() where id = new.account_id;
      insert into finance_account_logs (account_id, change_type, old_amount, new_amount, delta, note, transaction_id, changed_by)
      values (new.account_id, 'transaction', v_old_balance, v_new_balance, v_delta, 'Трансакција: ' || new.description, new.id, coalesce(v_actor, new.created_by));
    end if;
    new.updated_at := now();
    return new;
  end if;
end;
$$;

drop trigger if exists finance_entry_balance on public.finance_entries;
create trigger finance_entry_balance
after insert or update or delete on public.finance_entries
for each row execute function public.trg_finance_entry_balance();

create or replace function public.create_finance_entry(
  p_account_id uuid,
  p_kind text,
  p_description text,
  p_amount numeric,
  p_transaction_date date default current_date,
  p_notes text default null,
  p_repeat boolean default false,
  p_cadence text default 'monthly'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry uuid;
  v_rule uuid;
  v_currency text;
  v_date date := coalesce(p_transaction_date, current_date);
begin
  if not can('finance.manage') then raise exception 'not authorised'; end if;
  if p_kind not in ('income','expense') then raise exception 'Невалиден тип на трансакција'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Износот мора да е поголем од 0'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Описот е задолжителен'; end if;

  select currency into v_currency from finance_accounts where id = p_account_id and active;
  if not found then raise exception 'Избери активна сметка'; end if;

  if p_repeat then
    if p_cadence not in ('weekly','monthly','yearly') then raise exception 'Невалидно повторување'; end if;
    insert into finance_recurring_rules (
      account_id, kind, description, amount, currency, cadence, next_run_date, notes, created_by
    ) values (
      p_account_id, p_kind, trim(p_description), p_amount, v_currency, p_cadence,
      finance_next_date(v_date, p_cadence), nullif(trim(p_notes), ''), auth.uid()
    ) returning id into v_rule;
  end if;

  insert into finance_entries (
    transaction_date, kind, description, amount, currency, account_id, notes,
    recurring_rule_id, recurrence_date, created_by
  ) values (
    v_date, p_kind, trim(p_description), p_amount, v_currency, p_account_id,
    nullif(trim(p_notes), ''), v_rule, case when v_rule is null then null else v_date end, auth.uid()
  ) returning id into v_entry;

  return v_entry;
end;
$$;

create or replace function public.stop_finance_recurring(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can('finance.manage') then raise exception 'not authorised'; end if;
  update finance_recurring_rules set active = false, updated_at = now() where id = p_rule_id;
end;
$$;

create or replace function public.process_finance_recurring(p_today date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r finance_recurring_rules%rowtype;
  v_due date;
  v_count int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not can('finance.manage') then raise exception 'not authorised'; end if;

  for r in
    select rr.*
    from finance_recurring_rules rr
    join finance_accounts a on a.id = rr.account_id
    where rr.active and a.active and rr.next_run_date <= coalesce(p_today, current_date)
    order by rr.next_run_date
    for update of rr
  loop
    v_due := r.next_run_date;
    while v_due <= coalesce(p_today, current_date) loop
      insert into finance_entries (
        transaction_date, kind, description, amount, currency, account_id, notes,
        recurring_rule_id, recurrence_date, created_by
      ) values (
        v_due, r.kind, r.description, r.amount, r.currency, r.account_id, r.notes,
        r.id, v_due, r.created_by
      ) on conflict (recurring_rule_id, recurrence_date) do nothing;

      if found then v_count := v_count + 1; end if;
      v_due := finance_next_date(v_due, r.cadence);
    end loop;

    update finance_recurring_rules set next_run_date = v_due, updated_at = now() where id = r.id;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------
-- RLS + grants
-- -----------------------------------------------------------------
alter table public.finance_accounts enable row level security;
alter table public.finance_entries enable row level security;
alter table public.finance_recurring_rules enable row level security;
alter table public.finance_account_logs enable row level security;

drop policy if exists finance_accounts_v2_read on public.finance_accounts;
create policy finance_accounts_v2_read on public.finance_accounts for select using (can_page('finance'));
drop policy if exists finance_accounts_v2_manage on public.finance_accounts;
create policy finance_accounts_v2_manage on public.finance_accounts for all using (can('finance.manage')) with check (can('finance.manage'));

drop policy if exists finance_entries_v2_read on public.finance_entries;
create policy finance_entries_v2_read on public.finance_entries for select using (can_page('finance'));
drop policy if exists finance_entries_v2_manage on public.finance_entries;
create policy finance_entries_v2_manage on public.finance_entries for all using (can('finance.manage')) with check (can('finance.manage'));

drop policy if exists finance_recurring_v2_read on public.finance_recurring_rules;
create policy finance_recurring_v2_read on public.finance_recurring_rules for select using (can_page('finance'));
drop policy if exists finance_recurring_v2_manage on public.finance_recurring_rules;
create policy finance_recurring_v2_manage on public.finance_recurring_rules for all using (can('finance.manage')) with check (can('finance.manage'));

drop policy if exists finance_account_logs_v2_read on public.finance_account_logs;
create policy finance_account_logs_v2_read on public.finance_account_logs for select using (can_page('finance'));

revoke all on function public.create_finance_account(text,numeric,text,text) from public, anon;
grant execute on function public.create_finance_account(text,numeric,text,text) to authenticated, service_role;
revoke all on function public.update_finance_account(uuid,text,numeric,text,text,text) from public, anon;
grant execute on function public.update_finance_account(uuid,text,numeric,text,text,text) to authenticated, service_role;
revoke all on function public.archive_finance_account(uuid) from public, anon;
grant execute on function public.archive_finance_account(uuid) to authenticated, service_role;
revoke all on function public.create_finance_entry(uuid,text,text,numeric,date,text,boolean,text) from public, anon;
grant execute on function public.create_finance_entry(uuid,text,text,numeric,date,text,boolean,text) to authenticated, service_role;
revoke all on function public.stop_finance_recurring(uuid) from public, anon;
grant execute on function public.stop_finance_recurring(uuid) to authenticated, service_role;
revoke all on function public.process_finance_recurring(date) from public, anon;
grant execute on function public.process_finance_recurring(date) to authenticated, service_role;

-- Realtime for the two Finance sections.
do $$
declare t text;
begin
  foreach t in array array['finance_accounts','finance_entries','finance_recurring_rules','finance_account_logs'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- New-assignment notifications also keep the market separate from the title.
create or replace function public.trg_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market text;
  v_creator text;
begin
  if new.market_id is not null then
    select code || ' · ' || name into v_market from markets where id = new.market_id;
  end if;
  select full_name into v_creator from profiles where id = new.created_by;

  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into notifications (user_id, type, title, message, entity_type, entity_id)
    values (
      new.assigned_to,
      'new_assignment',
      new.title,
      concat_ws(' · ', case when v_market is not null then 'Пазар: ' || v_market end, 'Доделено од ' || coalesce(v_creator, 'OPS DECK')),
      'task',
      new.id
    );
  end if;

  if tg_op = 'INSERT' then
    insert into activity_events (actor_id, event_type, entity_type, entity_id, metadata)
    values (new.created_by, 'task.created', 'task', new.id,
            jsonb_build_object('title', new.title, 'department', new.department, 'market_id', new.market_id));
  end if;
  return new;
end;
$$;
