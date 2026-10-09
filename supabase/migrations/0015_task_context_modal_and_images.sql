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
