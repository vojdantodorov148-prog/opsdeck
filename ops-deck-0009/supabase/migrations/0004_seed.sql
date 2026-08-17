-- ============================================================
-- OPS DECK — 0004 roles, permissions, reference + demo data
-- Safe to run on an empty project. Idempotent.
-- ============================================================

insert into roles (key, label, rank) values
  ('owner','Owner',40), ('admin','Admin',30), ('manager','Manager',20), ('member','Member',10)
on conflict (key) do nothing;

insert into permissions (key, label) values
  ('vision_center.read','Read Vision Center'),
  ('vision_center.write','Edit Vision Center'),
  ('team.manage','Manage team'),
  ('tasks.assign','Assign work to others'),
  ('products.manage','Manage products and markets'),
  ('testing.manage','Manage product testing'),
  ('tools.manage','Manage tools'),
  ('settings.manage','Manage settings')
on conflict (key) do nothing;

-- owner + admin: everything
insert into role_permissions (role_id, permission_key)
select r.id, p.key from roles r cross join permissions p where r.key in ('owner','admin')
on conflict do nothing;

-- manager: operations, no strategy
insert into role_permissions (role_id, permission_key)
select r.id, k from roles r
cross join (values ('tasks.assign'),('products.manage'),('testing.manage')) as t(k)
where r.key = 'manager'
on conflict do nothing;

-- member: own work only (no explicit permissions)

insert into app_settings (key, value) values
  ('xp', '{"task_complete":10,"per_deliverable":20,"milestone":25}'::jsonb),
  ('campus', '{"image_url":null}'::jsonb),
  ('external_apps', '{"creative_testing_calendar":"https://example.com/creative-testing-calendar"}'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into company_vision (id, north_star)
values (1, 'Build a repeatable engine that finds a winning product-market pair every month without the founders in the loop.')
on conflict (id) do nothing;

-- ---------- brands ----------
insert into brands (name, slug) values
  ('Origon','origon'), ('Veterče','veterce'), ('Vitagen','vitagen'), ('Alpine Patches','alpine-patches')
on conflict (slug) do nothing;

-- ---------- markets ----------
insert into markets (code, name, currency, sort_order) values
  ('MK','North Macedonia','MKD',1),
  ('HR','Croatia','EUR',2),
  ('BG','Bulgaria','BGN',3),
  ('HU','Hungary','HUF',4),
  ('RO','Romania','RON',5),
  ('SI','Slovenia','EUR',6)
on conflict (code) do nothing;

-- ---------- products ----------
insert into products (brand_id, name, selling_price, currency, break_even_cpa, cogs, status, main_url)
select b.id, v.name, v.price, 'EUR', v.becpa, v.cogs, v.status::product_status, v.url
from (values
  ('alpine-patches','Alpine Sleep',   39.90, 21.50, 4.80, 'active',   'https://example.com/alpine-sleep'),
  ('alpine-patches','Alpine Relief',  44.90, 24.00, 5.40, 'active',   'https://example.com/alpine-relief'),
  ('vitagen',       'VitaSlim',       49.90, 27.00, 6.20, 'active',   'https://example.com/vitaslim'),
  ('origon',        'Cervion Pro',    59.90, 32.00, 8.10, 'approved', 'https://example.com/cervion-pro')
) as v(brand, name, price, becpa, cogs, status, url)
join brands b on b.slug = v.brand
where not exists (select 1 from products p where p.name = v.name);

-- ---------- tools ----------
insert into tools (name, description, url, category, icon, favorite, sort_order)
select * from (values
  ('Ad Creator','Generate ad variations','https://example.com/ad-creator','creation','wand',true,1),
  ('Ad Cloner','Clone winning visuals onto new products','https://example.com/ad-cloner','creation','copy',true,2),
  ('Ad Localizer','Translate and adapt creatives','https://example.com/ad-localizer','creation','languages',false,3),
  ('Landing IMG Creator','Build landing imagery','https://example.com/landing-img','creation','image',false,4),
  ('Meta Ads','Campaign manager','https://adsmanager.facebook.com','marketing','megaphone',true,5),
  ('Shopify','Stores and orders','https://admin.shopify.com','marketing','shopping-bag',true,6),
  ('Google Drive','Files and assets','https://drive.google.com','work','folder',false,7),
  ('Google Sheets','Spreadsheets','https://sheets.google.com','work','table',false,8),
  ('Canva','Design','https://canva.com','work','palette',false,9),
  ('Creative Testing Calendar','Concepts, hooks and angles','https://example.com/creative-testing-calendar','testing','calendar',true,10),
  ('TrendTrack','Product research','https://example.com/trendtrack','research','trending-up',false,11),
  ('Market Research','Market notes and sources','https://example.com/market-research','research','search',false,12)
) as v(name, description, url, category, icon, favorite, sort_order)
where not exists (select 1 from tools t where t.name = v.name);

-- ---------- product x market states ----------
insert into product_market_tests (product_id, market_id, status)
select p.id, m.id, v.status::market_test_status
from (values
  ('Alpine Sleep','HR','winner'),   ('Alpine Sleep','BG','winner'),
  ('Alpine Sleep','HU','testing'),  ('Alpine Sleep','RO','planned'),
  ('Alpine Relief','HR','preparing'),('Alpine Relief','BG','testing'),
  ('Alpine Relief','HU','planned'),
  ('Cervion Pro','HR','testing'),   ('Cervion Pro','BG','winner'),
  ('Cervion Pro','RO','planned'),
  ('VitaSlim','BG','winner'),       ('VitaSlim','HU','winner'),
  ('VitaSlim','RO','planned')
) as v(product, market, status)
join products p on p.name = v.product
join markets  m on m.code = v.market
on conflict (product_id, market_id) do nothing;

-- ---------- vision center ----------
insert into objectives (brand_id, title, description, status, progress, target_date, sort_order)
select b.id, v.title, v.descr, v.status::objective_status, v.progress, v.target, v.ord
from (values
  ('alpine-patches','Croatia: reach stable profitability','Hold blended MER above target for 30 straight days.','active',78,'2026-09-30'::date,1),
  ('alpine-patches','Test 15 creative concepts','Concepts, not variations. Tracked in the Creative Testing Calendar.','active',73,'2026-09-30'::date,2),
  ('vitagen','Find a second winning market','Hungary or Romania, whichever proves out first.','active',40,'2026-12-31'::date,1)
) as v(brand, title, descr, status, progress, target, ord)
join brands b on b.slug = v.brand
where not exists (select 1 from objectives o where o.title = v.title);

insert into strategic_plans (brand_id, horizon, title, sort_order)
select b.id, v.h::plan_horizon, v.t, v.o
from (values
  ('alpine-patches','now','Scale Alpine Sleep in Croatia',1),
  ('alpine-patches','now','Find an Alpine Relief winner',2),
  ('alpine-patches','now','Improve the advertorial system',3),
  ('alpine-patches','next','Enter Slovenia',1),
  ('alpine-patches','next','Test Alpine Focus',2),
  ('alpine-patches','next','Improve retention',3),
  ('alpine-patches','later','Germany',1),
  ('alpine-patches','later','New categories',2),
  ('alpine-patches','later','Subscription',3)
) as v(brand, h, t, o)
join brands b on b.slug = v.brand
where not exists (select 1 from strategic_plans s where s.title = v.t);
