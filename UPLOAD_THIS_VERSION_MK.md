# OPS DECK 0015 — COMPLETE VERIFIED SOURCE

Ова е целосната верзија на проектот. Не мешај фајлови од претходни 0015 пакети.

## GitHub
1. Отпакувај го ZIP-от.
2. Во GitHub отвори го ROOT на `opsdeck` repo-то.
3. `Add file` → `Upload files`.
4. Upload/replace ги сите фајлови и папки од оваа верзија директно во root.
5. Особено провери дека `src/services/tasks.ts` е заменет — оваа верзија ги содржи `attachTaskReferenceImage` и `setTaskResultFolderUrl`, кои недостигаа во live repo и го рушеа Netlify build-от.
6. Commit: `OPS DECK 0015 complete verified source`.

## Supabase
Не пуштај нов SQL ако revised 0015 SQL веќе е успешно пуштен.

## Netlify
Почекај auto deploy. Ако е Published, направи hard refresh на апликацијата.
