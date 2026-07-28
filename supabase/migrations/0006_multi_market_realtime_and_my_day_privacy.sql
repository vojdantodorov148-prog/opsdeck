-- ============================================================
-- OPS DECK — 0006 multi-market work, realtime copy and My Day privacy
-- Run once after 0005_macedonian_team_access_and_editable_text.sql.
-- ============================================================

-- Every signed-in user reads interface text overrides. Realtime makes an edit
-- made with the small pencil appear for everyone without a refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'app_texts'
     ) then
    execute 'alter publication supabase_realtime add table public.app_texts';
  end if;
end $$;

-- My Day is always scoped to auth.uid(). Even owners/managers only receive
-- their own assigned work and their own pending reviews through this RPC.
create or replace function my_week(p_from date, p_to date)
returns setof tasks
language sql
stable
security definer
set search_path = public
as $$
  select t.*
  from tasks t
  where t.assigned_to = auth.uid()
    and t.status <> 'done'
    and (
      t.scheduled_date between p_from and p_to
      or (t.scheduled_date is null and t.due_date between p_from and p_to)
      or (t.scheduled_date is null and t.due_date is null)
    )
  union
  select t.*
  from tasks t
  join task_reviews r on r.task_id = t.id
  where r.reviewer_id = auth.uid()
    and r.status = 'pending';
$$;

revoke all on function my_week(date, date) from public;
grant execute on function my_week(date, date) to authenticated;
