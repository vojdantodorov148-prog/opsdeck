-- ============================================================
-- OPS DECK — 0011 task assignment + completion guard
-- Run once after 0010_due_time_sku_product_link_and_direct_completion.sql.
-- ============================================================

-- Make direct completion errors explicit and keep the rule simple:
-- the assigned employee can finish the task, while users with tasks.assign
-- (owner/admin/manager) can manage/finish it as well.
create or replace function public.complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned_to uuid;
  v_current_user uuid := auth.uid();
begin
  if v_current_user is null then
    raise exception 'Нема активна сесија. Најави се повторно.';
  end if;

  select assigned_to
    into v_assigned_to
    from public.tasks
   where id = p_task_id;

  if not found then
    raise exception 'Задачата не постои.';
  end if;

  if v_assigned_to is null then
    raise exception 'Задачата нема извршител. Менаџер мора прво да ја додели на член.';
  end if;

  if v_assigned_to <> v_current_user
     and not public.has_permission(v_current_user, 'tasks.assign') then
    raise exception 'Оваа задача е доделена на друг член.';
  end if;

  update public.task_deliverables
     set completed_quantity = quantity,
         status = 'done'
   where task_id = p_task_id;

  update public.tasks
     set status = 'done'
   where id = p_task_id;
end;
$$;

revoke all on function public.complete_task(uuid) from public, anon;
grant execute on function public.complete_task(uuid) to authenticated, service_role;
