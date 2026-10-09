-- ============================================================
-- OPS DECK — 0015 Task detail context + optional task image
-- Run once after 0014_task_angles_headlines_and_delete.sql.
-- ============================================================

-- 1) Optional task-specific reference image.
-- If this is null, the app falls back to the product's first image.
alter table public.tasks
  add column if not exists reference_image_path text;

-- 2) Public image bucket used only for task-specific reference images.
-- Uploads are permission-protected; public URLs make employee download simple.
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-reference-images', 'task-reference-images', true, 10485760)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit;

-- Users who are allowed to assign work may attach/replace/remove reference images.
drop policy if exists task_reference_images_insert on storage.objects;
create policy task_reference_images_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'task-reference-images' and public.can('tasks.assign'));

drop policy if exists task_reference_images_update on storage.objects;
create policy task_reference_images_update on storage.objects
for update to authenticated
using (bucket_id = 'task-reference-images' and public.can('tasks.assign'))
with check (bucket_id = 'task-reference-images' and public.can('tasks.assign'));

drop policy if exists task_reference_images_delete on storage.objects;
create policy task_reference_images_delete on storage.objects
for delete to authenticated
using (bucket_id = 'task-reference-images' and public.can('tasks.assign'));

-- 3) Creative tasks use one shared folder link for the entire task instead of
-- one ready-file link per individual creative deliverable.
alter table public.tasks
  add column if not exists result_folder_url text;

-- Preserve a useful legacy link where one already exists on a creative deliverable.
update public.tasks t
set result_folder_url = (
  select d.url
  from public.task_deliverables d
  where d.task_id = t.id
    and d.url is not null
    and btrim(d.url) <> ''
  order by d.sort_order asc, d.id asc
  limit 1
)
where t.department = 'creative'
  and (t.result_folder_url is null or btrim(t.result_folder_url) = '')
  and exists (
    select 1
    from public.task_deliverables d
    where d.task_id = t.id
      and d.url is not null
      and btrim(d.url) <> ''
  );

-- Employees can update the folder link only on their own assigned task.
-- Managers/owners with tasks.assign may update any task.
create or replace function public.set_task_result_folder_url(p_task_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned_to uuid;
begin
  select assigned_to into v_assigned_to
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'task not found';
  end if;

  if v_assigned_to is distinct from auth.uid()
     and not public.has_permission(auth.uid(), 'tasks.assign') then
    raise exception 'not authorised';
  end if;

  update public.tasks
  set result_folder_url = nullif(btrim(p_url), ''),
      updated_at = now()
  where id = p_task_id;
end;
$$;

revoke all on function public.set_task_result_folder_url(uuid, text) from public, anon;
grant execute on function public.set_task_result_folder_url(uuid, text) to authenticated, service_role;

