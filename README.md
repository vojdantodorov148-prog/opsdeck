# OPS DECK

Централна интерна апликација за задачи, производи, продукт тестирање, алатки, тим и неделно планирање.

## Технологија

- React + TypeScript + Vite
- Tailwind CSS
- Supabase: база, Auth, RLS и Realtime
- GitHub → Netlify

## Прво поставување на Supabase

Во Supabase SQL Editor пушти ги миграциите по ред:

1. `0001_schema.sql`
2. `0002_automation.sql`
3. `0003_rls.sql`
4. `0004_seed.sql`
5. `0005_macedonian_team_access_and_editable_text.sql`

За веќе активна апликација пушти ја само новата `0005` миграција.

## Netlify environment variables

Задолжителни:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — серверска тајна за креирање/бришење тимски акаунти; никогаш не ја ставај во `VITE_` променлива или GitHub.

Опционални:

- `VITE_CAMPUS_IMAGE_URL`
- `VITE_LOGO_URL`

## Што содржи овој update

- цел интерфејс на македонски;
- отстранет Vision Center;
- креирање, уредување и бришење тимски акаунти;
- пристап до страници по корисник;
- бришење апликации од Алатки;
- менување линкови во Тестирање;
- Маркетинг Интелигенција како надворешна апликација;
- глобално уредување текст преку ситно моливче долу десно;
- профилни поставки: име, позиција, слика и лозинка;
- поширок и понизок кампус на Почетна;
- посовремен, топол кампус-дизајн;
- лого што може да се постави преку Поставки.

## Локално пуштање

```bash
npm install
npm run dev
```

Проверки:

```bash
npm run typecheck
npm test
npm run build
```

## Главна логика

Една доделена задача автоматски:

- се појавува кај извршителот;
- влегува во Мој ден;
- оди во точната фабрика според типот;
- се поврзува со производ и пазар;
- создава известување и активност.

Product Testing и страницата на производот го читаат истиот `product_market_tests` запис, без дупли податоци.

## Update без Terminal

Види `UPDATE_STEPS_MK.md`.

## Update 1.1 — Multi-market work and realtime copy

- Multi-select markets in Give Task
- Mixed landing/creative deliverables split into the correct factories
- Product deletion with confirmation
- Private My Day RPC scoped to the signed-in user
- Realtime interface text overrides
- Wider, lower and more detailed gamified campus

Run `supabase/migrations/0006_multi_market_realtime_and_my_day_privacy.sql` after updating the code.

## Update 0008: Finance, Brand Drive and delivery links

- `/finance`: P&L, capital, monthly revenue and recurring subscriptions.
- `/brands`: private Supabase Storage-powered brand document drive.
- Landing/creative deliverables support a finished-work URL that becomes a one-click button.
- `netlify/functions/generate-subscriptions.ts` generates due subscription expenses daily.
- Run `supabase/migrations/0008_finance_brand_drive_and_delivery_links.sql` after update 0007.
