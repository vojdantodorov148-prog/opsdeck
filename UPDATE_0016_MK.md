# OPS DECK Update 0016 — Secure REST API + MCP

Овој пакет е **PATCH**, не цела апликација. Намерно ги содржи само фајловите што се менуваат/додаваат, за да не ги презапише постоечките Task/Product fixes од 0015.

## Што додава

- Admin-only **Settings → API keys**: create, choose acting user, scopes, revoke.
- API keys се чуваат само како SHA-256 hash и немаат expiry додека не се revoke-ираат.
- REST JSON API под `/api/v1` за Products, Team, Tasks и Comments.
- `Idempotency-Key` за сите POST повици.
- Per-key rate limit (default 60 requests/minute).
- Admin-only API audit log во Settings.
- Product currency field во add/edit UI; продажна, breakeven и COGS се прикажуваат со валутата на производот.
- MCP endpoint на `/mcp` со 10 tools што го користат истиот REST API.
- Server-side download на product images од URL со проверка на тип/големина и блокирање private/local network targets.

## 1. GitHub — прво

1. Отпакувај `ops-deck-update-0016-secure-api-mcp.zip`.
2. Отвори ја папката `ops-deck-update-0016-secure-api-mcp`.
3. Во **root** на истиот GitHub repo избери **Add file → Upload files**.
4. Upload/replace ги **сите фајлови ВНАТРЕ во папката**. Не ја upload-ирај wrapper папката како под-папка.
5. Commit message:

`OPS DECK Update 0016 - Secure API and MCP`

Netlify може да стартува deploy веднаш. Нормално е MCP да не работи сè додека подоцна не се постават MCP env vars.

## 2. Supabase

1. Supabase → **SQL Editor → New query**.
2. Отвори `0016_secure_api_and_mcp.sql`.
3. Копирај сè → Run.
4. Очекувано: `Success. No rows returned`.
5. **Не ги пуштај повторно 0001–0015.**

## 3. Почекај Netlify да стане Published

По GitHub commit-от и SQL миграцијата, почекај последниот Netlify deploy да биде **Published**.

Не треба нов env var за REST API. REST API ги користи постоечките server variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Креирај API key во Ops Deck

1. Најави се како Owner/Admin.
2. **Settings → API keys**.
3. Внеси име, пример `Grok / Krsto`.
4. Одбери **Работи како корисник** — пример Vojdan.
5. Одбери scopes што му требаат:
   - `read`
   - `write:products`
   - `write:tasks`
   - `write:comments`
6. Кликни **Креирај API key**.
7. Копирај го raw key веднаш. Потоа Ops Deck го има само неговиот hash.

REST base URL:

`https://ops-deck.netlify.app/api/v1`

## 5. MCP — само ако сакаш AI agent да се поврзе преку MCP

За MCP препорачано е да креираш **посебен Ops Deck API key** со само scopes што му требаат на тој agent.

Во Netlify → **Site configuration → Environment variables** додај:

- `OPS_DECK_API_KEY` = raw Ops Deck API key што го креираше за MCP agent-от
- `OPS_DECK_MCP_TOKEN` = посебен долг случаен secret што MCP client-от ќе го користи како Bearer token

Потоа направи нов deploy.

MCP URL:

`https://ops-deck.netlify.app/mcp`

MCP client config:

- Transport: **Streamable HTTP**
- URL: `https://ops-deck.netlify.app/mcp`
- Header: `Authorization: Bearer <OPS_DECK_MCP_TOKEN>`

`OPS_DECK_API_KEY` останува server-side во Netlify и MCP серверот со него го повикува REST API.

## 6. Брз тест без terminal

- Отвори Settings и провери дали се појавуваат **API keys** и **API audit log**.
- Креирај тест key и потоа revoke-ирај го — треба веднаш да стане „Отповикан“.
- За API/MCP тест со agent, користи ги URL-ите и examples во root `README.md`.

## Безбедност

- Raw API keys не се зачувуваат во база.
- Revoked key веднаш престанува да работи.
- API keys не зависат од browser session.
- API scopes се проверуваат server-side.
- Per-key rate limit е во Postgres, па важи низ сите Netlify instances.
- Секој REST повик се audit-ира со key name, acting user, endpoint, status, result, време и duration.
- Нема DELETE REST endpoints.
- Remote product images не смеат да доаѓаат од localhost/private/reserved networks и се ограничени на 10 MB по слика.
