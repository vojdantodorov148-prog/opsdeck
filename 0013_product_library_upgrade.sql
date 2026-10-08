-- ============================================================
-- OPS DECK — 0013 Product Library Upgrade
-- Brand overview/search, required product brief, multiple angles,
-- and product image gallery/thumbnail support.
-- Run once after 0012_market_field_and_simple_finance.sql.
-- ============================================================

-- 1) Every product has a dedicated brief.
alter table public.products
  add column if not exists brief text not null default '';

-- Preserve useful old overview text as a starting brief for existing products.
update public.products
set brief = notes
where coalesce(brief, '') = ''
  and coalesce(notes, '') <> '';

-- 2) Optional multiple marketing angles per product.
create table if not exists public.product_angles (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title      text not null default '',
  body       text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_angles_product_idx
  on public.product_angles(product_id, sort_order, created_at);

-- 3) Product image metadata. Actual files live in Supabase Storage.
create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text     text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists product_images_product_idx
  on public.product_images(product_id, sort_order, created_at);

-- Public product imagery bucket. Upload/delete is still permission protected.
insert into storage.buckets (id, name, public, file_size_limit)
values ('product-images', 'product-images', true, 10485760)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit;

-- 4) RLS: all team members may read product library content;
-- only users with products.manage can change it.
alter table public.product_angles enable row level security;
alter table public.product_images enable row level security;

drop policy if exists product_angles_read on public.product_angles;
create policy product_angles_read on public.product_angles
for select to authenticated
using (public.is_member());

drop policy if exists product_angles_manage on public.product_angles;
create policy product_angles_manage on public.product_angles
for all to authenticated
using (public.can('products.manage'))
with check (public.can('products.manage'));

drop policy if exists product_images_read on public.product_images;
create policy product_images_read on public.product_images
for select to authenticated
using (public.is_member());

drop policy if exists product_images_manage on public.product_images;
create policy product_images_manage on public.product_images
for all to authenticated
using (public.can('products.manage'))
with check (public.can('products.manage'));

-- Storage object permissions for the product-images bucket.
drop policy if exists product_images_storage_insert on storage.objects;
create policy product_images_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'product-images' and public.can('products.manage'));

drop policy if exists product_images_storage_update on storage.objects;
create policy product_images_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'product-images' and public.can('products.manage'))
with check (bucket_id = 'product-images' and public.can('products.manage'));

drop policy if exists product_images_storage_delete on storage.objects;
create policy product_images_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'product-images' and public.can('products.manage'));

-- 5) Realtime refresh for product content when it changes on another device.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_angles'
    ) then
      alter publication supabase_realtime add table public.product_angles;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_images'
    ) then
      alter publication supabase_realtime add table public.product_images;
    end if;
  end if;
end $$;
