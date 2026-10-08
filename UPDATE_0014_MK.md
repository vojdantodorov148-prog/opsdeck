# OPS DECK Update 0014 — Task Creative Inputs

Овој update додава поврзување меѓу Product Library и задачите, плус директно бришење задачи и нов full-screen Give Task flow.

## Што е сменето

### 1. Ad headline опции под секој производ
- Во Product Detail, под `Бриф` и `Агли`, има нов сегмент `Ad headline опции`.
- Може да има неограничен број headline опции.
- Headline опциите може да се додаваат и при креирање/измена на производ.

### 2. Статичен оглас → Ad headline
Кога во `Додели задача` ќе избереш `Статичен оглас`:
- за секој статичен оглас може да се избере посебен зачуван headline;
- може да се избере `+ Додај нов headline`;
- новиот headline автоматски се зачувува во `Ad headline опции` на избраниот производ;
- избраниот headline се зачувува и во самата задача и му се прикажува на вработениот.

### 3. Advertorial / Listicle / Product Page → агол
За `Адверторијал`, `Листикл` и `Продукт страница`:
- може да се избере зачуван агол од производот;
- може да се внесе нов агол директно при доделување на задачата;
- новиот агол автоматски се зачувува кај `Агли` на производот;
- ако количината е поголема од 1, секој лендер има сопствен selector за агол.

Пример: 2 × Advertorial може да биде:
- Advertorial #1 → Агол A
- Advertorial #2 → Агол B

### 4. Бришење задачи
Во Task Detail / Task Drawer е додадено `Избриши`.
- creator-от на задачата може да ја избрише;
- owner/admin/manager со `tasks.assign` може да ја избрише;
- има confirmation пред трајно бришење.

### 5. Product search при доделување задача
Во `Додели задача` производот сега се бара со search bar по:
- име;
- SKU;
- бренд.

### 6. Full-screen `Додели задача`
Give Task popup-от сега е full-screen, со повеќе простор за product search, пазари, повеќе deliverables и индивидуални агли/headlines.

## Инсталација

### Чекор 1 — GitHub
1. Отпакувај `ops-deck-update-0014.zip`.
2. Отвори ја папката `ops-deck-0014`.
3. Во GitHub repository root → `Add file` → `Upload files`.
4. Upload/replace ги **сите фајлови ВНАТРЕ во `ops-deck-0014`**, не самата папка како nested folder.
5. Commit message: `OPS DECK Update 0014 - Task creative inputs`.

### Чекор 2 — Supabase
Во `Supabase → SQL Editor → New query` пушти ја само:

`0014_task_angles_headlines_and_delete.sql`

Очекуван резултат:

`Success. No rows returned`

Не ги пуштај повторно 0001–0013.

### Чекор 3 — Netlify
Почекај GitHub commit-от автоматски да направи deploy. Ако не започне:

`Netlify → Deploys → Trigger deploy → Deploy site`

Не се потребни нови environment variables.

## Брз тест
1. Отвори производ → провери дека под `Агли` има `Ad headline опции`.
2. `Додели задача` → пребарај производ преку search bar.
3. Избери `2 × Адверторијал` → избери различен агол за #1 и #2.
4. Избери `Статичен оглас` → додај нов headline → додели задача.
5. Отвори производ → новиот headline треба да е зачуван.
6. Отвори задачата како вработениот → аголот/headline-от треба да се гледа во испораката.
7. Отвори непотребна задача → `Избриши` → потврди.
