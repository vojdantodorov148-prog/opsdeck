-- ============================================================
-- OPS DECK — 0019 Untested creatives library
-- Per-product storage/Drive links + 24h retention after test start.
-- ============================================================

create table if not exists public.product_untested_creatives (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source_type text not null check (source_type in ('upload','drive')),
  storage_path text unique,
  external_url text,
  original_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  label text,
  added_by uuid references public.profiles(id) on delete set null default auth.uid(),
  tested_by uuid references public.profiles(id) on delete set null,
  testing_started_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_untested_creatives_source_check check (
    (source_type = 'upload' and storage_path is not null and external_url is null)
    or
    (source_type = 'drive' and external_url is not null and storage_path is null)
  )
);

create index if not exists product_untested_creatives_product_idx
  on public.product_untested_creatives(product_id, created_at desc);

create index if not exists product_untested_creatives_cleanup_idx
  on public.product_untested_creatives(delete_after)
  where delete_after is not null;

-- Private bucket. Original bytes are stored without image/video recompression.
insert into storage.buckets (id, name, public)
values ('untested-creatives', 'untested-creatives', false)
on conflict (id) do update set public = false;

alter table public.product_untested_creatives enable row level security;

drop policy if exists product_untested_creatives_read on public.product_untested_creatives;
create policy product_untested_creatives_read on public.product_untested_creatives
for select to authenticated
using (public.is_member());

drop policy if exists product_untested_creatives_manage on public.product_untested_creatives;
create policy product_untested_creatives_manage on public.product_untested_creatives
for all to authenticated
using (public.can('products.manage'))
with check (public.can('products.manage'));

-- Storage policies for private creative files.
drop policy if exists untested_creatives_storage_select on storage.objects;
create policy untested_creatives_storage_select on storage.objects
for select to authenticated
using (bucket_id = 'untested-creatives' and public.is_member());

drop policy if exists untested_creatives_storage_insert on storage.objects;
create policy untested_creatives_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'untested-creatives' and public.can('products.manage'));

drop policy if exists untested_creatives_storage_update on storage.objects;
create policy untested_creatives_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'untested-creatives' and public.can('products.manage'))
with check (bucket_id = 'untested-creatives' and public.can('products.manage'));

drop policy if exists untested_creatives_storage_delete on storage.objects;
create policy untested_creatives_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'untested-creatives' and public.can('products.manage'));

-- A checkbox starts a fixed 24h retention clock. Repeated writes of the same
-- testing_started_at value do not extend it. Unchecking cancels deletion.
create or replace function public.trg_untested_creative_retention()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.testing_started_at is null then
    new.delete_after := null;
    new.tested_by := null;
  elsif tg_op = 'UPDATE' and old.testing_started_at is not null then
    -- Once started, repeated writes cannot extend the 24h timer.
    new.testing_started_at := old.testing_started_at;
    new.delete_after := old.delete_after;
  else
    -- Use database time, not the browser/agent clock.
    new.testing_started_at := now();
    new.delete_after := new.testing_started_at + interval '24 hours';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists untested_creative_retention on public.product_untested_creatives;
create trigger untested_creative_retention
before insert or update of testing_started_at on public.product_untested_creatives
for each row execute function public.trg_untested_creative_retention();

-- Realtime lets the UI immediately reflect changes made by Grok/API.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'product_untested_creatives'
     ) then
    alter publication supabase_realtime add table public.product_untested_creatives;
  end if;
end $$;
