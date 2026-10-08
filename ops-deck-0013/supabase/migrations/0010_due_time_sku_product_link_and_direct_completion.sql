-- ============================================================
-- OPS DECK — 0010 deadline time, SKU UX, product links in tasks,
-- and direct task completion (review step removed from new work)
-- Run once after 0009_team_accounts_backend.sql.
-- ============================================================

-- 1) Deadlines now support both a date and an exact time.
alter table public.tasks
  add column if not exists due_time time;

-- Replace the assignment RPC with a backward-compatible signature.
-- p_due_time is appended at the end so existing DB calls that pass the
-- original 9 arguments (e.g. product-test preparation) continue to work.
drop function if exists public.create_assignment(
  text, uuid, jsonb, uuid, uuid, date, text, uuid, task_source
);

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
    insert into task_deliverables (task_id, type, quantity, sort_order)
    values (
      v_task,
      (v_item->>'type')::deliverable_type,
      coalesce((v_item->>'quantity')::int, 1),
      v_i
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

-- 2) Completing deliverable quantities no longer moves a task into review.
-- It simply moves a new task into "doing". The employee explicitly clicks
-- "Завршено" when the job is finished.
create or replace function public.trg_deliverable_progress()
returns trigger
language plpgsql
as $$
declare
  v_task uuid := coalesce(new.task_id, old.task_id);
  v_total int;
  v_done int;
  v_status task_status;
begin
  select coalesce(sum(quantity), 0), coalesce(sum(completed_quantity), 0)
    into v_total, v_done
    from task_deliverables
   where task_id = v_task;

  select status into v_status from tasks where id = v_task;

  if v_done > 0 and v_status = 'todo' then
    update tasks set status = 'doing', updated_at = now() where id = v_task;
  end if;

  return coalesce(new, old);
end;
$$;

-- 3) Direct completion RPC. No review record is created.
create or replace function public.complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned_to uuid;
begin
  select assigned_to into v_assigned_to
  from tasks
  where id = p_task_id;

  if not found then
    raise exception 'task not found';
  end if;

  if v_assigned_to is distinct from auth.uid()
     and not has_permission(auth.uid(), 'tasks.assign') then
    raise exception 'not authorised';
  end if;

  update task_deliverables
     set completed_quantity = quantity,
         status = 'done'
   where task_id = p_task_id;

  update tasks
     set status = 'done'
   where id = p_task_id;
end;
$$;

revoke all on function public.complete_task(uuid) from public, anon;
grant execute on function public.complete_task(uuid) to authenticated, service_role;

-- Existing tasks that were waiting in the old approval stage return to normal
-- work so they can be completed with the new direct-completion button.
update public.tasks
   set status = 'doing', updated_at = now()
 where status = 'review';

update public.task_reviews
   set status = 'changes_requested',
       comment = coalesce(comment, 'Legacy review flow closed by Update 0010'),
       updated_at = now()
 where status = 'pending';

-- Completion keeps XP/activity behavior, but the creator receives a normal
-- completion notification rather than a misleading "review needed" alert.
create or replace function public.trg_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp int;
  v_units int;
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
    select coalesce(sum(quantity), 0)
      into v_units
      from task_deliverables
     where task_id = new.id;

    v_xp := coalesce((select (value->>'task_complete')::int from app_settings where key = 'xp'), 10)
          + greatest(v_units - 1, 0)
            * coalesce((select (value->>'per_deliverable')::int from app_settings where key = 'xp'), 20);

    if new.assigned_to is not null then
      insert into xp_events (user_id, amount, reason, entity_type, entity_id)
      values (new.assigned_to, v_xp, 'task_completed', 'task', new.id);
    end if;

    insert into activity_events (actor_id, event_type, entity_type, entity_id, metadata)
    values (new.assigned_to, 'task.completed', 'task', new.id, jsonb_build_object('title', new.title));

    if new.created_by is not null and new.created_by <> new.assigned_to then
      insert into notifications (user_id, type, title, message, entity_type, entity_id)
      values (new.created_by, 'mention', new.title, 'Задачата е завршена', 'task', new.id);
    end if;
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- 4) My Day now only contains the signed-in user's own assigned work.
-- Pending review records from the legacy flow no longer create extra entries.
create or replace function public.my_week(p_from date, p_to date)
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
    );
$$;

revoke all on function public.my_week(date, date) from public, anon;
grant execute on function public.my_week(date, date) to authenticated, service_role;
