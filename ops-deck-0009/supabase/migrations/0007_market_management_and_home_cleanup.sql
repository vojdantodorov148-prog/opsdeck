-- ============================================================
-- OPS DECK — 0007 market management and live synchronization
-- Run once after 0006_multi_market_realtime_and_my_day_privacy.sql.
-- ============================================================

-- Product and testing managers can maintain the shared market catalogue.
drop policy if exists p_manage on markets;
create policy p_manage on markets for all
  using (can('products.manage') or can('testing.manage'))
  with check (can('products.manage') or can('testing.manage'));

-- Any market added or removed in Product Testing is reflected live in every
-- open selector and matrix that reads the shared markets table.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'markets'
     ) then
    execute 'alter publication supabase_realtime add table public.markets';
  end if;
end $$;
