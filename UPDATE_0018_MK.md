# OPS DECK Update 0018 — Telegram task notifications

Овој update додава Telegram известување кога член на тимот ќе добие нова задача.

## Како работи

- Постоечкиот `new_assignment` notification останува source of truth.
- Ако корисникот има поврзан Telegram, новата задача влегува во server-side outbox.
- Netlify dispatcher го праќа Telegram известувањето најдоцна во следниот scheduled run (обично до ~1 минута).
- Секоја задача се queue-ира само еднаш; retries не создаваат duplicate message.
- Работи и за задачи креирани од browser UI, REST API/MCP и други Ops Deck workflows што го користат постоечкиот assignment trigger.

## 1. GitHub

Отпакувај го ZIP-от и upload/replace ги **фајловите ВНАТРЕ директно во root на истиот GitHub repo**. Не ја upload-ирај wrapper папката како под-папка.

## 2. Supabase

Во SQL Editor пушти **само**:

`supabase/migrations/0018_telegram_task_notifications.sql`

Очекувано: `Success. No rows returned`.

## 3. Netlify secrets

Во Netlify → Site configuration → Environment variables додади:

- `TELEGRAM_BOT_TOKEN` = token-от од BotFather
- `TELEGRAM_WEBHOOK_SECRET` = нов random secret, пример 40+ знаци; користи само букви, бројки, `_` и `-`

За двете избери **Secret value**.

Потоа Redeploy и почекај `Published`.

## 4. Поврзи го Дучи

1. Ops Deck → **Team** → отвори го Дучи.
2. Во **Telegram известувања** кликни `Креирај connect линк`.
3. Испрати му го линкот.
4. Дучи го отвора линкот во Telegram и притиска **Start**.
5. Во рок од неколку секунди Ops Deck треба да покаже `Поврзан`.
6. Кликни `Испрати тест` за проверка.

Connect линкот важи 15 минути и може да се употреби еднаш.

## 5. Тест со вистинска задача

Додели му нова задача на Дучи. Telegram известувањето содржи:

- продукт / task title
- market
- deliverables
- deadline
- кој ја доделил задачата
- note, ако има
- копче `Отвори ја задачата`

Scheduled dispatcher-от работи секоја минута, па известувањето може да има до ~60 секунди delay.

## Безбедност

- Bot token-от е само во Netlify env и не оди во browser/Supabase.
- Telegram chat ID и pairing codes се server-only tables со RLS без browser policies.
- Telegram webhook користи `TELEGRAM_WEBHOOK_SECRET` header verification.
- Outbox + unique notification ID спречува duplicate task notifications при retry.
