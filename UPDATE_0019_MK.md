# OPS DECK Update 0019 — Нетестирани креативи

## Што додава

Во секој Product Detail има нов tab **„Нетестирани креативи“**, веднаш после **„Преглед“** и пред **„Пазари“**.

Во него можеш:

- директно да upload-ираш повеќе слики/видеа;
- да додаваш Google Drive folder/file линкови;
- да preview-ираш слики и видеа;
- да download-ираш upload-иран оригинален фајл;
- со едно checkbox поле **„Пуштено на тест“** да стартуваш 24h retention;
- да го тргнеш checkbox-от пред истекот и да го откажеш бришењето;
- рачно да избришеш погрешно додадена креатива.

Upload-ираните фајлови **не се компресираат / re-encode-ираат** — се чуваат оригиналните bytes. Browser direct upload е ограничен на 50 MB по фајл; за поголеми видеа користи Drive линк.

## Автоматско бришење

Кога ќе се штиклира **„Пуштено на тест“**:

1. се запишува `testing_started_at`;
2. `delete_after` автоматски станува точно +24h;
3. Netlify cleanup job проверува на секои 15 минути;
4. upload-иран фајл се брише и од Supabase Storage и од базата;
5. Drive link entry се брише само од Ops Deck — **не се брише ништо од Google Drive**.

Практично: бришењето е после 24h, со максимум ~15 минути до следниот cleanup run.

## Grok / API / MCP

REST endpoints:

- `GET /api/v1/products/:product_id/untested-creatives`
- `POST /api/v1/products/:product_id/untested-creatives`
- `GET /api/v1/products/:product_id/untested-creatives/:creative_id`
- `PATCH /api/v1/products/:product_id/untested-creatives/:creative_id`

POST поддржува:

- `kind: "drive"` + Google Drive URL;
- `kind: "file_url"` + јавен/temporary image/video URL. Ops Deck ги симнува оригиналните bytes без recompression (до 50 MB).

MCP tools за Grok:

- `list_untested_creatives`
- `add_untested_drive_link`
- `import_untested_creative_url`
- `get_untested_creative`
- `mark_untested_creative_testing`

За upload-ираните items API враќа fresh signed `download_url`, па Grok може брзо да ги презема без да се прави public bucket.

## Инсталација

1. Upload/replace ги **фајловите ВНАТРЕ од update folder-от директно во root на истиот GitHub repo**. Не ја upload-ирај wrapper папката.
2. Во Supabase SQL Editor пушти го целиот код од:
   `supabase/migrations/0019_untested_creatives.sql`
3. Почекај Netlify deploy да стане `Published`.
4. Grok/MCP connector-от можеби треба да се refresh/reconnect еднаш за да ги види 5-те нови tools.

Нема нови Netlify secrets за овој update.
