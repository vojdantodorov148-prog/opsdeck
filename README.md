# Ops Deck

The internal operating system for the company. Open it in the morning, see what needs
doing, hand work out, watch it land in the right place.

The one rule the code is built around: **giving someone work must not take longer than
messaging them.** Everything structural — routing to a department, notifying the
assignee, attaching work to a product and a market, updating My Day, logging activity —
happens automatically from a single action.

---

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, TypeScript (strict), Vite, Tailwind, React Router, TanStack Query |
| Backend | Supabase — Postgres, Auth, Row Level Security, Realtime |
| Deploy | GitHub → Netlify (frontend), Supabase (backend) |
| Tests | Vitest on the business logic |

UI primitives are hand-built rather than pulled from shadcn/ui. The design brief is
specific (warm neutrals, soft teal, generous spacing) and the default shadcn tokens
would have been fought at every step. The components live in `src/components/ui` and
are a few dozen lines each.

---

## Run it locally

```bash
npm install
cp .env.example .env      # fill in your Supabase URL and anon key
npm run dev
```

Without env vars the app renders a setup screen instead of a blank page.

```bash
npm run build       # tsc -b && vite build
npm run typecheck
npm test
```

---

## Supabase setup

1. Create a project at supabase.com.
2. Run the migrations in order, from the SQL editor or the CLI:

   ```
   supabase/migrations/0001_schema.sql       tables, enums, indexes
   supabase/migrations/0002_automation.sql   routing, triggers, RPCs
   supabase/migrations/0003_rls.sql          row level security
   supabase/migrations/0004_seed.sql         roles, permissions, demo data
   ```

   With the CLI: `supabase db push`.

3. Enable **Email** auth. Turn off public sign-ups — this is an internal tool; invite
   people from the Supabase dashboard instead.
4. Create your own user, then promote it to owner:

   ```sql
   insert into user_roles (user_id, role_id)
   select u.id, r.id
   from auth.users u, roles r
   where u.email = 'you@company.com' and r.key = 'owner'
   on conflict do nothing;
   ```

   A trigger already gives every new user a profile and the `member` role.

5. Copy the project URL and anon key into `.env`.

Demo accounts are deliberately **not** seeded with passwords. Create them through the
Supabase dashboard so no credentials live in the repository.

---

## Deploy to Netlify

1. Push the repository to GitHub.
2. In Netlify: **Add new site → Import from Git**, pick the repo.
3. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`).
4. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy. `netlify.toml` handles the SPA redirect and basic security headers.

Only the anon key ever reaches the browser. The service-role key must never be added
to a `VITE_` variable.

---

## How the important parts work

### Automatic routing

You choose a deliverable; the system chooses the department.

- Product page, advertorial, listicle, quiz, landing localization → **Landing Factory**
- Static ad, video ad, UGC, concept, image/hook variation → **Creative Factory**
- Research, campaign → **Testing**

A task with mixed deliverables lands where the bulk of the work is, ties going to the
first thing chosen. The rule lives in `fn_department_for_deliverable` (SQL) and is
mirrored in `src/lib/deliverables.ts` for optimistic UI only — the database is the
source of truth, and `src/test/routing.test.ts` covers the behaviour.

### One action, every view

`create_assignment` is a single Postgres function that creates the task, its
deliverables, routes it, notifies the assignee, and logs an activity event inside one
transaction. Nothing is written twice. My Day, Tasks, the factories, and the product
page all read the same `tasks` and `task_deliverables` rows — there are no per-screen
copies to drift.

### Product testing

`product_market_tests` has a unique constraint on `(product_id, market_id)`, so a
product's status in a market exists in exactly one row. The matrix on
`/testing/products` and the Markets tab on a product page render that same row.

`start_product_test` sets the status and, if you listed preparation work, creates one
task per assignee with their deliverables grouped underneath — which then routes
itself to the right factory.

Creative concept testing is **not** in here. The Creative Testing Calendar stays a
separate app; Ops Deck only launches it. Its URL is configurable in Settings.

### My Day

Due date and scheduled date are separate columns and stay that way. Work with a
deadline but no chosen day sits in Unscheduled rather than being force-fed into a slot.
Personal tasks are created inline — click a row, type, press Enter — and are private by
default (`is_private`, enforced in RLS).

### Permissions

Database-backed: `roles`, `permissions`, `role_permissions`, `user_roles`. Every policy
calls `can('some.permission')`. The `RequirePermission` component only hides
navigation; deleting it would not grant anyone access to a single extra row.

Vision Center (revenue, profit, objectives, strategic plans) is gated on
`vision_center.read` at the table level.

### Gamification

XP and levels only. Level *n* starts at `100·(n−1)²` XP, awarded on task completion by
a trigger, shown quietly in the sidebar. No leaderboards, no streaks, no coins — a
five-person team does not need to be ranked against itself.

### The campus

`src/features/home/campusScene.ts` draws the campus as a plain SVG string with an
isometric projection. Label positions are derived from world coordinates, so moving a
building moves its label. To replace it with a rendered illustration, set a campus
image URL in Settings (or `VITE_CAMPUS_IMAGE_URL`) — the same hotspots position
themselves over the image.

---

## Layout

```
src/
  app/           router, providers, permission guard
  components/    layout shell, sidebar, command bar, UI primitives
  features/      one folder per area of the product
  lib/           routing rules, week maths, status tokens
  services/      every Supabase call, grouped by domain
  test/          Vitest specs for the logic that matters
supabase/migrations/
```

## Configuration reference

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_CAMPUS_IMAGE_URL` | Optional campus illustration (Settings overrides it) |

| Setting key | Purpose |
| --- | --- |
| `external_apps.creative_testing_calendar` | URL the Testing page launches |
| `campus.image_url` | Campus illustration |
| `xp` | XP awarded per completed task and deliverable |

## Not built yet

Shopify and Meta ingestion, natural-language command parsing, Telegram/Slack
notifications, workflow templates. The seams exist — settings-driven external apps, a
service layer per domain, a command bar whose handlers are separate from its matcher —
but none of it is stubbed with fake data. Brand metrics stay empty until someone enters
real numbers.
