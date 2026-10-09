# OPS DECK Update 0015 — Task Detail Context

## Што е сменето

1. Отворањето на задача повеќе не е тесен drawer од десната страна. Task Detail сега е широк, центриран modal за полесна работа.
2. Над Product Link се прикажува Product Brief директно од ПРОИЗВОДИ:
   - една кратка preview линија;
   - `Copy full brief` копче што го копира целиот бриф.
3. Под Product Brief се прикажува Product Image:
   - многу мал thumbnail за да не троши простор;
   - `Download` копче за директно симнување.
4. При `Додели задача` има ново опционално поле `Слика за задачата`:
   - ако upload-ираш слика, таа се користи во Task Detail;
   - ако не upload-ираш ништо, автоматски се користи првата/главната слика од производот во ПРОИЗВОДИ.
5. Product Brief и главната product image не се копираат во задачата — се читаат од актуелниот производ, па измените во ПРОИЗВОДИ се гледаат и во задачата. Само рачно upload-ираната task image е специфична за задачата.

## Инсталација

### 1. GitHub — прво
- Отпакувај го ZIP пакетот.
- Влези во папката `ops-deck-0015`.
- Upload/replace ги **сите фајлови ВНАТРЕ во папката директно во root на постоечкиот GitHub repo**.
- Не ја качувај `ops-deck-0015` како дополнителна папка.
- Commit: `OPS DECK Update 0015 - Task Detail Context`

### 2. Supabase
- Supabase → SQL Editor → New query.
- Пушти ја само миграцијата:
  `0015_task_context_modal_and_images.sql`
- Очекувано: `Success. No rows returned`.
- Не ги пуштај повторно 0001–0014.

### 3. Netlify
- Почекај автоматскиот deploy од GitHub.
- Ако не почне: Deploys → Trigger deploy → Deploy site.
- Нема нов environment variable.

## Брз тест

1. Отвори постоечка задача што има производ — modal-от треба да е центриран и широк.
2. Провери Product Brief → Copy full brief.
3. Провери Product Image → Download.
4. Додели нова задача без upload слика → треба да ја покаже главната product image.
5. Додели друга задача со upload слика → треба да ја покаже upload-ираната слика наместо product image.

## Дополнување: еден folder link за готови креативи

Кај creative task повеќе нема посебно поле за готов линк под секој Static/Video creative.
Сега под целата секција „Испораки“ има само едно поле **„Готови креативи“**, каде се става folder link за целата задача.
Лендинг задачите остануваат со посебен линк по deliverable, затоа што тие можат да имаат различни готови страници.
Постоечки creative task што веќе има зачуван deliverable link автоматски го префрла првиот таков линк во новото folder поле.

