-- ============================================================
-- OPS DECK — 0014 task angles, Ad headlines and task cleanup
-- Run once after 0013_product_library_upgrade.sql.
-- ============================================================

-- 1) Reusable Ad headline options per product.
create table if not exists public.product_ad_headlines (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  headline   text not null check (btrim(headline) <> ''),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_ad_headlines_product_idx
  on public.product_ad_headlines(product_id, sort_order, created_at);

alter table public.product_ad_headlines enable row level security;

drop policy if exists product_ad_headlines_read on public.product_ad_headlines;
create policy product_ad_headlines_read on public.product_ad_headlines
for select to authenticated
using (public.is_member());

drop policy if exists product_ad_headlines_manage on public.product_ad_headlines;
create policy product_ad_headlines_manage on public.product_ad_headlines
for all to authenticated
using (public.can('products.manage'))
with check (public.can('products.manage'));

-- A team member assigning work may create a new reusable option directly
-- from the Give Task flow. Editing/removing the product library remains
-- protected by products.manage.
drop policy if exists product_ad_headlines_task_insert on public.product_ad_headlines;
create policy product_ad_headlines_task_insert on public.product_ad_headlines
for insert to authenticated
with check (public.is_member());

drop policy if exists product_angles_task_insert on public.product_angles;
create policy product_angles_task_insert on public.product_angles
for insert to authenticated
with check (public.is_member());

-- 2) Store a snapshot of the selected angle/headline on each deliverable.
-- The snapshot means an old task stays clear even if the product library is
-- edited later.
alter table public.task_deliverables
  add column if not exists angle_id uuid references public.product_angles(id) on delete set null,
  add column if not exists angle_title text,
  add column if not exists angle_body text,
  add column if not exists ad_headline_id uuid references public.product_ad_headlines(id) on delete set null,
  add column if not exists ad_headline text;

create index if not exists task_deliverables_angle_idx on public.task_deliverables(angle_id);
create index if not exists task_deliverables_headline_idx on public.task_deliverables(ad_headline_id);

-- 3) Keep the existing assignment RPC signature, but persist the new optional
-- deliverable metadata when it is supplied by the app.
create or replace function public.create_assignment(
  p_title        text,
  p_assigned_to  uuid,
  p_deliverables jsonb,
  p_product_id   uuid    default null,
  p_market_id    uuid    default null,
  p_due_date     date    default null,
  p_notes        text    default null,
  p_test_id      uuid    default null,
  p_source       task_source default 'quick_action',
  p_due_time     time    default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid;
  v_item jsonb;
  v_i int := 0;
begin
  if not is_member() then
    raise exception 'not authorised';
  end if;

  insert into tasks (
    title, description, created_by, assigned_to, product_id, market_id,
    due_date, due_time, source, product_market_test_id
  ) values (
    p_title, p_notes, auth.uid(), p_assigned_to, p_product_id, p_market_id,
    p_due_date, p_due_time, p_source, p_test_id
  )
  returning id into v_task;

  for v_item in
    select * from jsonb_array_elements(coalesce(p_deliverables, '[]'::jsonb))
  loop
    insert into task_deliverables (
      task_id, type, quantity, sort_order,
      angle_id, angle_title, angle_body,
      ad_headline_id, ad_headline
    ) values (
      v_task,
      (v_item->>'type')::deliverable_type,
      coalesce((v_item->>'quantity')::int, 1),
      v_i,
      case when coalesce(v_item->>'angle_id', '') <> '' then (v_item->>'angle_id')::uuid else null end,
      nullif(v_item->>'angle_title', ''),
      nullif(v_item->>'angle_body', ''),
      case when coalesce(v_item->>'ad_headline_id', '') <> '' then (v_item->>'ad_headline_id')::uuid else null end,
      nullif(v_item->>'ad_headline', '')
    );
    v_i := v_i + 1;
  end loop;

  return v_task;
end;
$$;

revoke all on function public.create_assignment(
  text, uuid, jsonb, uuid, uuid, date, text, uuid, task_source, time
) from public, anon;
grant execute on function public.create_assignment(
  text, uuid, jsonb, uuid, uuid, date, text, uuid, task_source, time
) to authenticated, service_role;

-- 4) Realtime refresh for newly saved product headline options.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'product_ad_headlines'
     ) then
    alter publication supabase_realtime add table public.product_ad_headlines;
  end if;
end $$;
