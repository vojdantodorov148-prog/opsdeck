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

---

## Secure REST API (`/api/v1`)

Ops Deck exposes a server-to-server JSON API for AI agents and automations. It does **not** use the browser login session.

### Create an API key

1. Sign in as an Ops Deck owner/admin.
2. Open **Settings → API keys**.
3. Choose a name, the Ops Deck user the key should act as, and scopes:
   - `read`
   - `write:products`
   - `write:tasks`
   - `write:comments`
4. Copy the raw key immediately. Only its SHA-256 hash is stored; the raw key cannot be shown again.
5. Keys do not expire. Revoke them from Settings when they are no longer needed.

Every API request uses:

```bash
Authorization: Bearer odk_live_...
```

Base URL:

```text
https://ops-deck.netlify.app/api/v1
```

All POST endpoints support `Idempotency-Key`. Reusing the same key with the same request replays the stored response instead of creating a duplicate. Reusing it for a different request returns `409`.

### Products

List/search products:

```bash
curl -sS 'https://ops-deck.netlify.app/api/v1/products?search=sleep&brand=Alpine' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

Get one product:

```bash
curl -sS 'https://ops-deck.netlify.app/api/v1/products/PRODUCT_ID' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

Create a product. Remote images are downloaded server-side, checked as images, limited to 10 MB each, and stored in the `product-images` Supabase bucket:

```bash
curl -sS -X POST 'https://ops-deck.netlify.app/api/v1/products' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: product-alpine-sleep-001' \
  -d '{
    "name": "Alpine Sleep",
    "brand": "Alpine",
    "price": 35,
    "currency": "EUR",
    "sku": "ALP-SLEEP-01",
    "brief": "Full product brief...",
    "main_link": "https://example.com/alpine-sleep",
    "image_urls": ["https://example.com/product.jpg"]
  }'
```

Allowed API brand values are `Alpine`, `Origon`, `Ветерче`, and `Vitagen`.

Update product content and optionally replace its full image gallery / product links:

```bash
curl -sS -X PATCH 'https://ops-deck.netlify.app/api/v1/products/PRODUCT_ID' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "brief": "Updated full brief...",
    "main_link": "https://example.com/new-page",
    "image_urls": ["https://example.com/new-product.jpg"],
    "links": [
      {"label": "Supplier", "url": "https://example.com/supplier"}
    ]
  }'
```

### Team

List active members:

```bash
curl -sS 'https://ops-deck.netlify.app/api/v1/team' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

### Tasks

List tasks with filters:

```bash
curl -sS 'https://ops-deck.netlify.app/api/v1/tasks?assignee=USER_ID&product=PRODUCT_ID&market=GR&status=todo&category=creatives' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

`market` accepts a market ID, code, or exact name. `category` is `landing` or `creatives`.

Get one task including its note, comments, deliverables, and links:

```bash
curl -sS 'https://ops-deck.netlify.app/api/v1/tasks/TASK_ID' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

Create **exactly one task** per request. `due_at` must be ISO 8601 and include `Z` or an explicit timezone offset:

```bash
curl -sS -X POST 'https://ops-deck.netlify.app/api/v1/tasks' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: alpine-sleep-gr-static-001' \
  -d '{
    "product_id": "PRODUCT_ID",
    "market": "GR",
    "category": "creatives",
    "assignee_id": "USER_ID",
    "deliverables": [
      {"type": "static_ad", "count": 3}
    ],
    "due_at": "2026-12-26T13:00:00+01:00",
    "note": "Use the approved headline options."
  }'
```

Update status, assignee, folder URL, and/or deliverable links:

```bash
curl -sS -X PATCH 'https://ops-deck.netlify.app/api/v1/tasks/TASK_ID' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "done",
    "result_folder_url": "https://drive.google.com/drive/folders/...",
    "deliverable_links": [
      {"deliverable_id": "DELIVERABLE_ID", "url": "https://example.com/final"}
    ]
  }'
```

Add a comment. The comment author is always the Ops Deck user attached to the API key:

```bash
curl -sS -X POST 'https://ops-deck.netlify.app/api/v1/tasks/TASK_ID/comments' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: task-comment-001' \
  -d '{"text":"Finished the first three statics."}'
```

There are intentionally **no DELETE API endpoints**.

### Errors and rate limits

Validation errors return HTTP `400` with field names, for example:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Validation failed.",
    "fields": {"due_at": "Must be ISO 8601 and include Z or an explicit timezone offset."}
  },
  "request_id": "..."
}
```

Authentication/authorization uses `401` / `403`; missing records use `404`; rate limiting uses `429`. API keys default to 60 requests per minute. Every API request is logged in **Settings → API audit log**.

## MCP server (`/mcp`)

The same host also exposes a stateless Streamable HTTP MCP endpoint:

```text
https://ops-deck.netlify.app/mcp
```

It exposes these tools:

- `list_products`
- `get_product`
- `create_product`
- `update_product`
- `list_team`
- `list_tasks`
- `get_task`
- `create_task`
- `update_task`
- `add_comment`

The MCP server wraps the REST API rather than bypassing it, so the same scopes, validation, idempotency, audit log, and rate limit apply.

### Netlify environment variables for MCP

Create an Ops Deck API key in Settings with the scopes the MCP agent should have, then set its raw value as:

```text
OPS_DECK_API_KEY=odk_live_...
```

Protect the public MCP endpoint with a separate long random secret:

```text
OPS_DECK_MCP_TOKEN=<long-random-secret>
```

Redeploy Netlify after setting/changing environment variables.

When connecting an MCP client, use:

```text
URL: https://ops-deck.netlify.app/mcp
Authorization: Bearer <OPS_DECK_MCP_TOKEN>
Transport: Streamable HTTP
```

`OPS_DECK_API_KEY` stays server-side on Netlify and is never sent to the MCP client.
