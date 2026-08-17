-- ============================================================
-- OPS DECK — 0008 Finance, Brand Drive and automatic subscriptions
-- Run once after 0007_market_management_and_home_cleanup.sql.
-- ============================================================

-- ---------- permissions + page access helper ----------
insert into permissions (key, label) values
  ('finance.manage', 'Manage finance'),
  ('brands.manage', 'Manage brand documents')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key)
select r.id, p.key
from roles r
cross join permissions p
where r.key in ('owner','admin')
  and p.key in ('finance.manage','brands.manage')
on conflict do nothing;

insert into role_permissions (role_id, permission_key)
select r.id, 'brands.manage'
from roles r
where r.key = 'manager'
on conflict do nothing;

create or replace function can_page(p_page text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.key = 'owner'
  ) or exists (
    select 1 from page_access pa
    where pa.user_id = auth.uid() and pa.page_key = p_page and pa.allowed
  ) or (
    not exists (select 1 from page_access pa where pa.user_id = auth.uid())
    and p_page in ('home','my_day','tasks','products','landings','creatives','testing','brands','tools','notes','team')
  );
$$;

-- ---------- finance ----------
create table if not exists finance_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  vendor      text,
  category    text not null default 'Претплати',
  amount      numeric(14,2) not null check (amount > 0),
  currency    text not null default 'EUR',
  billing_day int not null default 1 check (billing_day between 1 and 28),
  starts_on   date not null default current_date,
  ends_on     date,
  active      boolean not null default true,
  notes       text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists monthly_revenues (
  id          uuid primary key default gen_random_uuid(),
  month       date not null,
  source      text not null,
  amount      numeric(14,2) not null check (amount > 0),
  currency    text not null default 'EUR',
  brand_id    uuid references brands(id) on delete set null,
  notes       text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (month = date_trunc('month', month)::date)
);

create table if not exists finance_transactions (
  id                  uuid primary key default gen_random_uuid(),
  transaction_date    date not null default current_date,
  kind                text not null check (kind in ('income','expense')),
  category            text not null,
  description         text not null,
  amount              numeric(14,2) not null check (amount > 0),
  currency            text not null default 'EUR',
  source              text not null default 'manual' check (source in ('manual','subscription','monthly_revenue')),
  subscription_id     uuid references finance_subscriptions(id) on delete cascade,
  subscription_period date,
  monthly_revenue_id  uuid unique references monthly_revenues(id) on delete cascade,
  brand_id            uuid references brands(id) on delete set null,
  notes               text,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (subscription_id, subscription_period)
);

create table if not exists capital_accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric(14,2) not null default 0,
  currency    text not null default 'EUR',
  notes       text,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists finance_transactions_date_idx on finance_transactions(transaction_date desc);
create index if not exists finance_transactions_kind_idx on finance_transactions(kind);
create index if not exists monthly_revenues_month_idx on monthly_revenues(month desc);

-- Monthly revenue rows are automatically reflected in P&L as income transactions.
create or replace function sync_monthly_revenue_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from finance_transactions where monthly_revenue_id = old.id;
    return old;
  end if;

  insert into finance_transactions (
    transaction_date, kind, category, description, amount, currency,
    source, monthly_revenue_id, brand_id, notes, created_by
  ) values (
    new.month, 'income', 'Месечен приход', new.source, new.amount, upper(new.currency),
    'monthly_revenue', new.id, new.brand_id, new.notes, new.created_by
  )
  on conflict (monthly_revenue_id) do update set
    transaction_date = excluded.transaction_date,
    description = excluded.description,
    amount = excluded.amount,
    currency = excluded.currency,
    brand_id = excluded.brand_id,
    notes = excluded.notes,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_revenue_sync on monthly_revenues;
create trigger monthly_revenue_sync
after insert or update or delete on monthly_revenues
for each row execute function sync_monthly_revenue_transaction();

-- Generates due subscription expenses for a month. It is safe to run repeatedly.
create or replace function generate_subscription_transactions(
  p_month date default date_trunc('month', current_date)::date
)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_count int := 0;
begin
  if auth.role() <> 'service_role' and not can('finance.manage') then
    raise exception 'not authorised';
  end if;

  insert into finance_transactions (
    transaction_date, kind, category, description, amount, currency,
    source, subscription_id, subscription_period, notes, created_by
  )
  select
    (v_month + (s.billing_day - 1))::date,
    'expense',
    s.category,
    coalesce(nullif(s.vendor, ''), s.name),
    s.amount,
    upper(s.currency),
    'subscription',
    s.id,
    v_month,
    s.notes,
    s.created_by
  from finance_subscriptions s
  where s.active
    and s.starts_on <= (v_month + interval '1 month - 1 day')::date
    and (s.ends_on is null or s.ends_on >= v_month)
    and (
      v_month < date_trunc('month', current_date)::date
      or (v_month + (s.billing_day - 1))::date <= current_date
    )
  on conflict (subscription_id, subscription_period) do update set
    transaction_date = excluded.transaction_date,
    category = excluded.category,
    description = excluded.description,
    amount = excluded.amount,
    currency = excluded.currency,
    notes = excluded.notes,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function generate_subscription_transactions(date) from public;
grant execute on function generate_subscription_transactions(date) to authenticated, service_role;

-- ---------- brand drive ----------
create table if not exists brand_documents (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  name        text not null,
  storage_path text not null unique,
  mime_type   text,
  file_size   bigint,
  category    text not null default 'Друго',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists brand_documents_brand_idx on brand_documents(brand_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values ('brand-drive', 'brand-drive', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- ---------- RLS ----------
alter table finance_subscriptions enable row level security;
alter table monthly_revenues enable row level security;
alter table finance_transactions enable row level security;
alter table capital_accounts enable row level security;
alter table brand_documents enable row level security;

drop policy if exists finance_subscriptions_read on finance_subscriptions;
create policy finance_subscriptions_read on finance_subscriptions for select
  using (can_page('finance'));
drop policy if exists finance_subscriptions_manage on finance_subscriptions;
create policy finance_subscriptions_manage on finance_subscriptions for all
  using (can('finance.manage')) with check (can('finance.manage'));

drop policy if exists monthly_revenues_read on monthly_revenues;
create policy monthly_revenues_read on monthly_revenues for select
  using (can_page('finance'));
drop policy if exists monthly_revenues_manage on monthly_revenues;
create policy monthly_revenues_manage on monthly_revenues for all
  using (can('finance.manage')) with check (can('finance.manage'));

drop policy if exists finance_transactions_read on finance_transactions;
create policy finance_transactions_read on finance_transactions for select
  using (can_page('finance'));
drop policy if exists finance_transactions_manage on finance_transactions;
create policy finance_transactions_manage on finance_transactions for all
  using (can('finance.manage')) with check (can('finance.manage'));

drop policy if exists capital_accounts_read on capital_accounts;
create policy capital_accounts_read on capital_accounts for select
  using (can_page('finance'));
drop policy if exists capital_accounts_manage on capital_accounts;
create policy capital_accounts_manage on capital_accounts for all
  using (can('finance.manage')) with check (can('finance.manage'));

drop policy if exists brand_documents_read on brand_documents;
create policy brand_documents_read on brand_documents for select
  using (can_page('brands'));
drop policy if exists brand_documents_insert on brand_documents;
create policy brand_documents_insert on brand_documents for insert
  with check (can_page('brands') and uploaded_by = auth.uid());
drop policy if exists brand_documents_update on brand_documents;
create policy brand_documents_update on brand_documents for update
  using (uploaded_by = auth.uid() or can('brands.manage'))
  with check (uploaded_by = auth.uid() or can('brands.manage'));
drop policy if exists brand_documents_delete on brand_documents;
create policy brand_documents_delete on brand_documents for delete
  using (uploaded_by = auth.uid() or can('brands.manage'));

-- Storage access for the private Brand Drive bucket.
drop policy if exists brand_drive_read on storage.objects;
create policy brand_drive_read on storage.objects for select to authenticated
  using (bucket_id = 'brand-drive' and public.can_page('brands'));
drop policy if exists brand_drive_insert on storage.objects;
create policy brand_drive_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-drive' and public.can_page('brands'));
drop policy if exists brand_drive_update on storage.objects;
create policy brand_drive_update on storage.objects for update to authenticated
  using (bucket_id = 'brand-drive' and public.can_page('brands'))
  with check (bucket_id = 'brand-drive' and public.can_page('brands'));
drop policy if exists brand_drive_delete on storage.objects;
create policy brand_drive_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-drive' and public.can_page('brands'));

-- Shared data should refresh live for users who have the related page open.
do $$
declare t text;
begin
  foreach t in array array[
    'finance_subscriptions','monthly_revenues','finance_transactions','capital_accounts','brand_documents'
  ] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
