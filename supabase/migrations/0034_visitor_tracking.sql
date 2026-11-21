-- ============================================================================
-- Ibom Vendors Hub — Visitor & store view tracking
-- ============================================================================
-- Migration 0034: idempotent, applied on every deploy via vercel-build
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Site visitors — every page load (logged-in or not), keyed by IP
-- ----------------------------------------------------------------------------
create table if not exists site_visitors (
  id            uuid primary key default gen_random_uuid(),
  ip            text not null,
  path          text not null,
  user_id       uuid references users(id) on delete set null,
  user_role     text,
  referrer      text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

drop trigger if exists site_visitors_set_updated_at on site_visitors;

create index if not exists site_visitors_ip_idx on site_visitors(ip);
create index if not exists site_visitors_created_idx on site_visitors(created_at);
create index if not exists site_visitors_path_idx on site_visitors(path);
create index if not exists site_visitors_user_idx on site_visitors(user_id);

-- ----------------------------------------------------------------------------
-- 2. Store views — every time a storefront page (/s/[slug]) is loaded
-- ----------------------------------------------------------------------------
create table if not exists store_views (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid references stores(id) on delete cascade,
  ip          text not null,
  user_id     uuid references users(id) on delete set null,
  user_role   text,
  created_at  timestamptz not null default now()
);

drop trigger if exists store_views_set_updated_at on store_views;

create index if not exists store_views_store_idx on store_views(store_id);
create index if not exists store_views_created_idx on store_views(created_at);
create index if not exists store_views_ip_idx on store_views(ip);

-- ----------------------------------------------------------------------------
-- 3. Product views — every time a product detail page is loaded
-- ----------------------------------------------------------------------------
create table if not exists product_views (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  ip          text not null,
  user_id     uuid references users(id) on delete set null,
  user_role   text,
  created_at  timestamptz not null default now()
);

drop trigger if exists product_views_set_updated_at on product_views;

create index if not exists product_views_product_idx on product_views(product_id);
create index if not exists product_views_created_idx on product_views(created_at);
create index if not exists product_views_ip_idx on product_views(ip);

-- ----------------------------------------------------------------------------
-- RLS: app_runtime can insert reads; admins read all
-- ----------------------------------------------------------------------------
alter table if exists site_visitors enable row level security;
alter table if exists store_views enable row level security;
alter table if exists product_views enable row level security;

-- Site visitors: anyone can insert (public tracking), admins read all
create policy site_visitors_insert on site_visitors
  for insert to app_runtime
  with check (true);

create policy site_visitors_admin_read on site_visitors
  for select to app_runtime
  using (
    exists (select 1 from users where id = app_current_user_id() and role in ('admin','super_admin'))
  );

-- Store views: anyone can insert, admins read all
create policy store_views_insert on store_views
  for insert to app_runtime
  with check (true);

create policy store_views_admin_read on store_views
  for select to app_runtime
  using (
    exists (select 1 from users where id = app_current_user_id() and role in ('admin','super_admin'))
  );

-- Product views: anyone can insert, admins read all
create policy product_views_insert on product_views
  for insert to app_runtime
  with check (true);

create policy product_views_admin_read on product_views
  for select to app_runtime
  using (
    exists (select 1 from users where id = app_current_user_id() and role in ('admin','super_admin'))
  );

commit;

-- ============================================================================
-- Notes:
-- - site_visitors: every page load on the platform (logged-in + anonymous)
-- - store_views: every /s/[slug] storefront page load
-- - product_views: every product detail page load
-- - IP is captured from x-forwarded-for / remote_addr headers
-- ============================================================================
