-- ============================================================
-- OPS DECK — 0002 automation (routing, triggers, RPCs)
-- One user action must fan out to every view. That happens here,
-- not in the client, so no screen can drift out of sync.
-- ============================================================

-- ---------- permission helpers ----------
create or replace function has_permission(p_user uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = p_user and rp.permission_key = p_key
  );
$$;

create or replace function can(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select has_permission(auth.uid(), p_key);
$$;

create or replace function is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

-- ---------- automatic routing ----------
-- The user picks a deliverable. The system picks the department.
create or replace function fn_department_for_deliverable(p_type deliverable_type)
returns department language sql immutable as $$
  select case
    when p_type in ('product_page','advertorial','listicle','quiz','landing_localization','other_landing')
      then 'landing'::department
    when p_type in ('static_ad','video_ad','ugc','creative_concept','image_variation',
                    'hook_variation','creative_localization','other_creative')
      then 'creative'::department
    when p_type in ('research','campaign')
      then 'testing'::department
    else 'general'::department
  end;
$$;

-- A task lands in the department of its heaviest deliverable group.
create or replace function fn_route_task(p_task uuid)
returns department language plpgsql as $$
declare v_dept department;
begin
  select fn_department_for_deliverable(type) into v_dept
  from task_deliverables where task_id = p_task
  group by type order by sum(quantity) desc, min(sort_order) limit 1;
  return coalesce(v_dept, 'general'::department);
end;
$$;

create or replace function trg_deliverable_routes_task()
returns trigger language plpgsql as $$
declare v_task uuid := coalesce(new.task_id, old.task_id);
begin
  update tasks set department = fn_route_task(v_task), updated_at = now() where id = v_task;
  return coalesce(new, old);
end;
$$;

create trigger deliverable_routes_task
after insert or update of type, quantity or delete on task_deliverables
for each row execute function trg_deliverable_routes_task();

-- ---------- deliverable progress rolls up to the task ----------
create or replace function trg_deliverable_progress()
returns trigger language plpgsql as $$
declare
  v_task uuid := coalesce(new.task_id, old.task_id);
  v_total int; v_done int; v_status task_status;
begin
  select coalesce(sum(quantity),0), coalesce(sum(completed_quantity),0)
    into v_total, v_done from task_deliverables where task_id = v_task;

  select status into v_status from tasks where id = v_task;

  if v_total > 0 and v_done >= v_total and v_status not in ('done','review') then
    update tasks set status = 'review', updated_at = now() where id = v_task;
  elsif v_done > 0 and v_done < v_total and v_status = 'todo' then
    update tasks set status = 'doing', updated_at = now() where id = v_task;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger deliverable_progress
after insert or update of completed_quantity or delete on task_deliverables
for each row execute function trg_deliverable_progress();

-- ---------- assignment fan-out ----------
create or replace function trg_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into notifications (user_id, type, title, message, entity_type, entity_id)
    values (new.assigned_to, 'new_assignment', new.title,
            'Assigned by ' || coalesce((select full_name from profiles where id = new.created_by), 'Ops Deck'),
            'task', new.id);
  end if;

  if tg_op = 'INSERT' then
    select coalesce(p.name, 'Task') into v_label from products p where p.id = new.product_id;
    insert into activity_events (actor_id, event_type, entity_type, entity_id, metadata)
    values (new.created_by, 'task.created', 'task', new.id,
            jsonb_build_object('title', new.title, 'department', new.department));
  end if;
  return new;
end;
$$;

create trigger task_assigned after insert or update of assigned_to on tasks
for each row execute function trg_task_assigned();

-- ---------- completion: timestamp + XP + activity ----------
create or replace function trg_task_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_xp int; v_units int;
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
    select coalesce(sum(quantity),0) into v_units from task_deliverables where task_id = new.id;
    v_xp := coalesce((select (value->>'task_complete')::int from app_settings where key = 'xp'), 10)
          + greatest(v_units - 1, 0) * coalesce((select (value->>'per_deliverable')::int from app_settings where key = 'xp'), 20);

    if new.assigned_to is not null then
      insert into xp_events (user_id, amount, reason, entity_type, entity_id)
      values (new.assigned_to, v_xp, 'task_completed', 'task', new.id);
    end if;

    insert into activity_events (actor_id, event_type, entity_type, entity_id, metadata)
    values (new.assigned_to, 'task.completed', 'task', new.id, jsonb_build_object('title', new.title));

    if new.created_by is not null and new.created_by <> new.assigned_to then
      insert into notifications (user_id, type, title, message, entity_type, entity_id)
      values (new.created_by, 'review_needed', new.title, 'Marked done', 'task', new.id);
    end if;
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger task_completed before update of status on tasks
for each row execute function trg_task_completed();

-- ---------- XP rolls into levels (100 XP curve, gentle) ----------
create or replace function trg_xp_level()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  insert into user_levels (user_id, total_xp) values (new.user_id, 0)
  on conflict (user_id) do nothing;

  update user_levels
     set total_xp = total_xp + new.amount,
         level    = greatest(1, floor(sqrt((total_xp + new.amount) / 100.0))::int + 1),
         updated_at = now()
   where user_id = new.user_id
  returning total_xp into v_total;
  return new;
end;
$$;

create trigger xp_level after insert on xp_events
for each row execute function trg_xp_level();

-- ---------- review flow ----------
create or replace function trg_review_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and new.reviewer_id is not null then
    insert into notifications (user_id, type, title, message, entity_type, entity_id)
    values (new.reviewer_id, 'review_needed',
            (select title from tasks where id = new.task_id),
            'Submitted for review', 'task', new.task_id);
    -- reviewer's My Day picks this up through the pending review, not a duplicate task
  end if;
  return new;
end;
$$;

create trigger review_created after insert on task_reviews
for each row execute function trg_review_created();

-- ---------- product x market status changes are company news ----------
create or replace function trg_pmt_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into activity_events (actor_id, event_type, entity_type, entity_id, metadata)
    values (auth.uid(), 'test.status_changed', 'product_market_test', new.id,
            jsonb_build_object(
              'product', (select name from products where id = new.product_id),
              'market',  (select code from markets  where id = new.market_id),
              'from', old.status, 'to', new.status));
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger pmt_status before update on product_market_tests
for each row execute function trg_pmt_status();

-- ---------- RPC: create an assignment in one transaction ----------
-- p_deliverables: [{"type":"advertorial","quantity":2}, ...]
create or replace function create_assignment(
  p_title        text,
  p_assigned_to  uuid,
  p_deliverables jsonb,
  p_product_id   uuid    default null,
  p_market_id    uuid    default null,
  p_due_date     date    default null,
  p_notes        text    default null,
  p_test_id      uuid    default null,
  p_source       task_source default 'quick_action'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_task uuid;
  v_item jsonb;
  v_i    int := 0;
begin
  if not is_member() then raise exception 'not authorised'; end if;

  insert into tasks (title, description, created_by, assigned_to, product_id, market_id,
                     due_date, source, product_market_test_id)
  values (p_title, p_notes, auth.uid(), p_assigned_to, p_product_id, p_market_id,
          p_due_date, p_source, p_test_id)
  returning id into v_task;

  for v_item in select * from jsonb_array_elements(coalesce(p_deliverables, '[]'::jsonb)) loop
    insert into task_deliverables (task_id, type, quantity, sort_order)
    values (v_task, (v_item->>'type')::deliverable_type,
            coalesce((v_item->>'quantity')::int, 1), v_i);
    v_i := v_i + 1;
  end loop;

  return v_task;
end;
$$;

-- ---------- RPC: start / prepare a product x market test ----------
create or replace function start_product_test(
  p_product_id uuid,
  p_market_id  uuid,
  p_status     market_test_status,
  p_owner_id   uuid    default null,
  p_offer      text    default null,
  p_notes      text    default null,
  p_prep       jsonb   default '[]'::jsonb   -- [{"type":"advertorial","quantity":2,"assigned_to":"uuid"}]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_test uuid;
  v_item jsonb;
  v_assignee uuid;
  v_group jsonb;
  v_product text;
  v_market  text;
begin
  if not is_member() then raise exception 'not authorised'; end if;

  insert into product_market_tests (product_id, market_id, status, owner_id, offer, notes,
                                    start_date)
  values (p_product_id, p_market_id, p_status, coalesce(p_owner_id, auth.uid()), p_offer, p_notes,
          case when p_status = 'testing' then current_date else null end)
  on conflict (product_id, market_id) do update
     set status   = excluded.status,
         owner_id = coalesce(excluded.owner_id, product_market_tests.owner_id),
         offer    = coalesce(excluded.offer, product_market_tests.offer),
         notes    = coalesce(excluded.notes, product_market_tests.notes),
         start_date = coalesce(product_market_tests.start_date, excluded.start_date),
         updated_at = now()
  returning id into v_test;

  select name into v_product from products where id = p_product_id;
  select code into v_market  from markets  where id = p_market_id;

  -- one task per assignee, deliverables grouped underneath
  for v_assignee in
    select distinct (value->>'assigned_to')::uuid
    from jsonb_array_elements(coalesce(p_prep, '[]'::jsonb))
    where value->>'assigned_to' is not null
  loop
    select jsonb_agg(jsonb_build_object('type', value->>'type', 'quantity', value->>'quantity'))
      into v_group
      from jsonb_array_elements(p_prep)
     where (value->>'assigned_to')::uuid = v_assignee;

    perform create_assignment(
      v_product || ' — ' || v_market,
      v_assignee, v_group, p_product_id, p_market_id, null,
      'Test preparation', v_test, 'workflow'::task_source);
  end loop;

  return v_test;
end;
$$;

-- ---------- RPC: my day (assigned work + pending reviews, one call) ----------
create or replace function my_week(p_from date, p_to date)
returns setof tasks language sql stable security definer set search_path = public as $$
  select t.* from tasks t
  where t.assigned_to = auth.uid()
    and t.status <> 'done'
    and (t.scheduled_date between p_from and p_to
         or (t.scheduled_date is null and t.due_date between p_from and p_to)
         or t.scheduled_date is null and t.due_date is null)
  union
  select t.* from tasks t
  join task_reviews r on r.task_id = t.id
  where r.reviewer_id = auth.uid() and r.status = 'pending';
$$;
