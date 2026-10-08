# OPS DECK Update 0011 — Task Completion Fix

## Што поправа

- Копчето „Завршено“ повеќе не се прикажува на обичен член за задача што не му е доделена.
- Линкот и progress контролите се editable само за извршителот или за owner/admin/manager.
- Owner/admin/manager сега може директно од Task Detail да смени или додели извршител на стара/недоделена задача.
- Ако стара задача нема извршител, UI јасно го покажува тоа наместо employee да добива `not authorised`.
- Backend `complete_task` враќа јасна македонска порака за: нема сесија, нема извршител, или задачата е доделена на друг член.

## Инсталација

1. Upload/replace ги фајловите од update пакетот во истиот GitHub repository и Commit.
2. Во Supabase → SQL Editor → New query пушти ја само `0011_task_assignment_and_completion_guard.sql`.
3. Очекувано: `Success. No rows returned`.
4. Почекај Netlify да го објави новиот deploy.
5. Отвори ја конкретната стара задача како Owner. Ако пишува „Недоделена задача“, избери го точниот вработен во полето „Доделено на“.
6. Вработениот нека refresh-ира и нека кликне „Завршено“ — треба да работи.
