-- ============================================================================
-- Ibom Vendors Hub — Multi-vendor e-commerce SaaS schema
-- PostgreSQL (Supabase compatible)
-- ----------------------------------------------------------------------------
-- This migration is idempotent (IF NOT EXISTS everywhere) and is applied by
-- scripts/migrate.ts. Every tenant-scoped table carries a store_id, owner_id or
-- user_id so that Row Level Security (0002_rls.sql) can enforce isolation.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Shared order/checkout reference generators ---------------------------------
create sequence if not exists order_reference_seq start 100001;
create sequence if not exists checkout_reference_seq start 500001;

create or replace function next_order_reference() returns text
language plpgsql as $$
declare n bigint;
begin
  n := nextval('order_reference_seq');
  return 'IVH-' || to_char(now(), 'YYMM') || '-' || lpad(n::text, 6, '0');
end;
$$;

create or replace function next_checkout_reference() returns text
language plpgsql as $$
declare n bigint;
begin
  n := nextval('checkout_reference_seq');
  return 'CHK-' || to_char(now(), 'YYMM') || '-' || lpad(n::text, 6, '0');
end;
$$;

create or replace function next_payment_reference(prefix text default 'PAY') returns text
language plpgsql as $$
begin
  return prefix || '-' || to_char(now(), 'YYMMDD') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Identity & access
-- ---------------------------------------------------------------------------
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  password_hash     text,
  full_name         text not null,
  phone             text,
  role              text not null default 'customer'
                    check (role in ('super_admin','admin','vendor','customer')),
  status            text not null default 'active'
                    check (status in ('active','suspended','deleted')),
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  avatar_url        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists users_email_lower_key on users (lower(email));
create index if not exists users_role_idx on users (role);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
for each row execute function set_updated_at();

-- Multi-role support: a user always has users.role as their primary role, and
-- may hold additional roles (e.g. a vendor who is also a customer).
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null check (role in ('super_admin','admin','vendor','customer')),
  granted_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- One-time tokens: email verification, password reset, email change ----------
create table if not exists auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       text not null check (type in ('verify_email','reset_password','email_change')),
  token_hash text not null,
  payload    jsonb not null default '{}',
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_tokens_hash_idx on auth_tokens (token_hash);
create index if not exists auth_tokens_user_idx on auth_tokens (user_id, type);

create table if not exists vendor_profiles (
  user_id     uuid primary key references users(id) on delete cascade,
  position    text,
  bio         text,
  nin         text,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists customer_profiles (
  user_id           uuid primary key references users(id) on delete cascade,
  default_address   jsonb not null default '{}',
  city              text,
  state             text,
  marketing_opt_in  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists delivery_addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  label      text,
  recipient  text not null,
  phone      text not null,
  address    text not null,
  city       text,
  state      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Platform settings
-- ---------------------------------------------------------------------------
create table if not exists platform_settings (
  id                   integer primary key default 1 check (id = 1),
  platform_name        text not null default 'Ibom Vendors Hub',
  tagline              text not null default 'Every business. One address.',
  logo_url             text,
  main_domain          text not null default 'localhost:3000',
  support_email        text not null default 'support@ibomvendorshub.com',
  support_phone        text not null default '+234 800 000 0000',
  currency             text not null default 'NGN',
  currency_symbol      text not null default '₦',
  country              text not null default 'Nigeria',
  default_trial_days   integer not null default 14,
  grace_period_days    integer not null default 0,
  commission_rate      numeric(5,2) not null default 5.00,
  require_vendor_approval boolean not null default false,
  payments_enabled     boolean not null default true,
  sandbox_payments     boolean not null default true,
  paystack_public_key  text,
  paystack_secret_key  text,
  email_from           text,
  resend_api_key       text,
  expiry_reminder_days integer[] not null default array[7,3,1],
  terms_markdown       text,
  privacy_markdown     text,
  social               jsonb not null default '{}',
  maintenance_mode     boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists platform_settings_set_updated_at on platform_settings;
create trigger platform_settings_set_updated_at before update on platform_settings
for each row execute function set_updated_at();

insert into platform_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Categories (dynamic feature engine)
-- ---------------------------------------------------------------------------
create table if not exists store_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  icon        text,
  image_url   text,
  -- Feature flags consumed by the whole application, e.g.
  -- {"catalogue":true,"cart":true,"stock":true,"variants":true,
  --  "customMeasurements":true,"productionTracking":true,"prepTime":false,
  --  "appointments":false,"quotations":true,"delivery":true,"pickup":true,
  --  "warranty":false,"operatingHours":true,"addons":false,"madeToOrder":true}
  features    jsonb not null default '{}'::jsonb,
  -- Configurable product attributes: [{"key":"material","label":"Material",
  -- "type":"select","options":["Cotton","Silk"],"required":false}]
  attributes  jsonb not null default '[]'::jsonb,
  -- Vendor-configurable product fields (e.g. warranty for electronics)
  -- Order workflow: [{"key":"placed","label":"Order placed"}, ...]
  workflow    jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists store_categories_set_updated_at on store_categories;
create trigger store_categories_set_updated_at before update on store_categories
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Stores, domains and subscriptions
-- ---------------------------------------------------------------------------
create table if not exists stores (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references users(id) on delete cascade,
  category_id         uuid references store_categories(id) on delete set null,
  name                text not null,
  slug                text not null unique,
  tagline             text,
  description         text,
  logo_url            text,
  cover_url           text,
  email               text,
  phone               text,
  whatsapp            text,
  website             text,
  address             text,
  city                text,
  state               text,
  country             text not null default 'Nigeria',
  status              text not null default 'active'
                      check (status in ('pending','active','suspended','expired','rejected')),
  visibility          text not null default 'public' check (visibility in ('public','unlisted')),
  manual_suspension   boolean not null default false,
  suspension_reason   text,
  suspended_at        timestamptz,
  suspended_by        uuid references users(id),
  access_until        timestamptz,
  approved_at         timestamptz,
  approved_by         uuid references users(id),
  rejection_reason    text,
  operating_hours     jsonb not null default '{}'::jsonb,
  accepts_orders      boolean not null default true,
  accepts_delivery    boolean not null default true,
  accepts_pickup      boolean not null default true,
  delivery_fee        numeric(14,2) not null default 0,
  minimum_order       numeric(14,2) not null default 0,
  delivery_areas      text,
  prep_time_minutes   integer not null default 30,
  rating_avg          numeric(3,2) not null default 0,
  rating_count        integer not null default 0,
  is_featured         boolean not null default false,
  settings            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists stores_owner_idx on stores (owner_id);
create index if not exists stores_category_idx on stores (category_id);
create index if not exists stores_status_idx on stores (status);

drop trigger if exists stores_set_updated_at on stores;
create trigger stores_set_updated_at before update on stores
for each row execute function set_updated_at();

create table if not exists store_domains (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  subdomain  text not null unique,
  is_primary boolean not null default true,
  status     text not null default 'active' check (status in ('active','reserved','released')),
  created_at timestamptz not null default now()
);
create index if not exists store_domains_store_idx on store_domains (store_id);

create table if not exists reserved_subdomains (
  name       text primary key,
  reason     text,
  created_at timestamptz not null default now()
);

create table if not exists subdomain_change_requests (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references stores(id) on delete cascade,
  requested_subdomain text not null,
  reason              text,
  status              text not null default 'pending'
                      check (status in ('pending','approved','rejected','cancelled')),
  admin_note          text,
  reviewed_by         uuid references users(id),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists subdomain_requests_status_idx on subdomain_change_requests (status);

-- Subscription plans ---------------------------------------------------------
create table if not exists subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  description     text,
  price           numeric(14,2) not null default 0,
  currency        text not null default 'NGN',
  interval_months integer not null default 1,
  duration_days   integer not null default 30,
  trial_days      integer not null default 0,
  product_limit   integer,
  order_limit     integer,
  features        jsonb not null default '[]'::jsonb,
  is_active       boolean not null default true,
  is_featured     boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists subscription_plans_set_updated_at on subscription_plans;
create trigger subscription_plans_set_updated_at before update on subscription_plans
for each row execute function set_updated_at();

create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  plan_id       uuid not null references subscription_plans(id),
  status        text not null default 'active'
                check (status in ('trialing','active','expired','cancelled','pending')),
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  cancelled_at  timestamptz,
  auto_renew    boolean not null default false,
  reminder_stage integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists subscriptions_store_idx on subscriptions (store_id);
create index if not exists subscriptions_expiry_idx on subscriptions (status, expires_at);
create unique index if not exists subscriptions_one_current_idx
  on subscriptions (store_id) where status in ('trialing','active');

drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at before update on subscriptions
for each row execute function set_updated_at();

create table if not exists subscription_history (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete set null,
  store_id        uuid not null references stores(id) on delete cascade,
  from_status     text,
  to_status       text not null,
  from_expires_at timestamptz,
  to_expires_at   timestamptz,
  note            text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Catalogue
-- ---------------------------------------------------------------------------
create table if not exists product_categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (store_id, slug)
);

drop trigger if exists product_categories_set_updated_at on product_categories;
create trigger product_categories_set_updated_at before update on product_categories
for each row execute function set_updated_at();

create table if not exists products (
  id                     uuid primary key default gen_random_uuid(),
  store_id               uuid not null references stores(id) on delete cascade,
  category_id            uuid references product_categories(id) on delete set null,
  name                   text not null,
  slug                   text not null,
  sku                    text,
  kind                   text not null default 'product' check (kind in ('product','service')),
  description            text,
  short_description      text,
  price                  numeric(14,2) not null default 0,
  compare_at_price       numeric(14,2),
  currency               text not null default 'NGN',
  pricing_type           text not null default 'fixed' check (pricing_type in ('fixed','from','quotation')),
  track_stock            boolean not null default false,
  stock_quantity         integer not null default 0,
  low_stock_threshold    integer not null default 5,
  is_available           boolean not null default true,
  is_featured            boolean not null default false,
  condition              text check (condition in ('new','used','refurbished')),
  brand                  text,
  model                  text,
  warranty_info          text,
  warranty_months        integer,
  specifications         jsonb not null default '{}'::jsonb,
  attributes             jsonb not null default '{}'::jsonb,
  made_to_order          boolean not null default false,
  production_days        integer,
  prep_time_minutes      integer,
  portion                text,
  service_duration_minutes integer,
  size_guide             jsonb not null default '[]'::jsonb,
  tags                   text[] not null default '{}',
  rating_avg             numeric(3,2) not null default 0,
  rating_count           integer not null default 0,
  sales_count            integer not null default 0,
  views_count            integer not null default 0,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (store_id, slug)
);
create index if not exists products_store_idx on products (store_id, is_available);
create index if not exists products_category_idx on products (category_id);
create index if not exists products_kind_idx on products (kind);

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at before update on products
for each row execute function set_updated_at();

create table if not exists product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  alt        text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on product_images (product_id, sort_order);

create table if not exists product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products(id) on delete cascade,
  name           text not null,
  sku            text,
  attributes     jsonb not null default '{}'::jsonb,
  price          numeric(14,2),
  stock_quantity integer not null default 0,
  is_available   boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists product_variants_product_idx on product_variants (product_id);

create table if not exists product_addons (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  name         text not null,
  price        numeric(14,2) not null default 0,
  is_available boolean not null default true,
  sort_order   integer not null default 0
);

create table if not exists inventory_movements (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  variant_id   uuid references product_variants(id) on delete set null,
  delta        integer not null,
  reason       text not null,
  order_id     uuid,
  note         text,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now()
);
create index if not exists inventory_movements_store_idx on inventory_movements (store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Services, bookings and quotations
-- ---------------------------------------------------------------------------
create table if not exists service_bookings (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references stores(id) on delete cascade,
  product_id        uuid references products(id) on delete set null,
  order_id          uuid,
  customer_id       uuid references users(id) on delete set null,
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  scheduled_date    date not null,
  scheduled_time    text not null,
  duration_minutes  integer,
  location          text,
  notes             text,
  status            text not null default 'requested'
                    check (status in ('requested','confirmed','rescheduled','completed','cancelled','no_show')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists bookings_store_idx on service_bookings (store_id, scheduled_date);
create index if not exists bookings_order_idx on service_bookings (order_id);

drop trigger if exists service_bookings_set_updated_at on service_bookings;
create trigger service_bookings_set_updated_at before update on service_bookings
for each row execute function set_updated_at();

create table if not exists service_quotations (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores(id) on delete cascade,
  product_id       uuid references products(id) on delete set null,
  order_id         uuid,
  customer_id      uuid references users(id) on delete set null,
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text,
  title            text,
  description      text,
  measurements     jsonb not null default '{}'::jsonb,
  reference_images jsonb not null default '[]'::jsonb,
  budget           numeric(14,2),
  preferred_date   date,
  status           text not null default 'requested'
                   check (status in ('requested','quoted','accepted','rejected','expired','cancelled')),
  quoted_amount    numeric(14,2),
  quote_note       text,
  valid_until      timestamptz,
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists quotations_store_idx on service_quotations (store_id, status);
create index if not exists quotations_email_idx on service_quotations (lower(customer_email));

drop trigger if exists service_quotations_set_updated_at on service_quotations;
create trigger service_quotations_set_updated_at before update on service_quotations
for each row execute function set_updated_at();

create table if not exists service_attachments (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references service_quotations(id) on delete cascade,
  url           text not null,
  name          text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id                         uuid primary key default gen_random_uuid(),
  reference                  text not null unique default next_order_reference(),
  checkout_reference         text not null,
  store_id                   uuid not null references stores(id) on delete restrict,
  customer_id                uuid references users(id) on delete set null,
  customer_name              text not null,
  customer_email             text not null,
  customer_phone             text not null,
  status                     text not null default 'placed'
                             check (status in ('placed','awaiting_payment','payment_confirmed','accepted',
                               'rejected','awaiting_production','in_production','production_completed',
                               'ready_for_dispatch','preparing','ready_for_pickup','dispatched',
                               'delivered','in_service','completed','cancelled','refunded','expired')),
  payment_status             text not null default 'pending'
                             check (payment_status in ('pending','paid','failed','refunded','partially_refunded')),
  fulfilment_type            text not null default 'delivery'
                             check (fulfilment_type in ('delivery','pickup','service','booking')),
  currency                   text not null default 'NGN',
  subtotal                   numeric(14,2) not null default 0,
  delivery_fee               numeric(14,2) not null default 0,
  service_fee                numeric(14,2) not null default 0,
  discount                   numeric(14,2) not null default 0,
  total                      numeric(14,2) not null default 0,
  amount_paid                numeric(14,2) not null default 0,
  platform_commission        numeric(14,2) not null default 0,
  vendor_payable             numeric(14,2) not null default 0,
  delivery_address           jsonb not null default '{}'::jsonb,
  delivery_notes             text,
  customer_notes             text,
  scheduled_for              timestamptz,
  estimated_completion_date  date,
  estimated_dispatch_date    date,
  estimated_delivery_date    date,
  accepted_at                timestamptz,
  rejected_at                timestamptz,
  rejection_reason           text,
  production_started_at      timestamptz,
  production_completed_at    timestamptz,
  ready_at                   timestamptz,
  dispatched_at              timestamptz,
  delivered_at               timestamptz,
  completed_at               timestamptz,
  cancelled_at               timestamptz,
  cancellation_reason        text,
  production_progress        integer not null default 0 check (production_progress between 0 and 100),
  tracking_number            text,
  tracking_carrier           text,
  stock_committed            boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists orders_store_idx on orders (store_id, created_at desc);
create index if not exists orders_customer_idx on orders (lower(customer_email));
create index if not exists orders_checkout_idx on orders (checkout_reference);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists orders_customer_id_idx on orders (customer_id);

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at before update on orders
for each row execute function set_updated_at();

create table if not exists order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  product_id       uuid references products(id) on delete set null,
  variant_id       uuid references product_variants(id) on delete set null,
  kind             text not null default 'product' check (kind in ('product','service')),
  name             text not null,
  variant_name     text,
  sku              text,
  unit_price       numeric(14,2) not null default 0,
  quantity         integer not null default 1 check (quantity > 0),
  line_total       numeric(14,2) not null default 0,
  attributes       jsonb not null default '{}'::jsonb,
  addons           jsonb not null default '[]'::jsonb,
  measurements     jsonb not null default '{}'::jsonb,
  reference_images jsonb not null default '[]'::jsonb,
  notes            text,
  duration_minutes integer,
  created_at       timestamptz not null default now()
);
create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_product_idx on order_items (product_id);

create table if not exists order_status_history (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  from_status      text,
  to_status        text not null,
  note             text,
  actor_id         uuid references users(id) on delete set null,
  actor_role       text not null default 'system',
  customer_visible boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on order_status_history (order_id, created_at);

create table if not exists order_tracking (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  carrier         text,
  tracking_number text,
  status          text,
  message         text,
  location        text,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists order_tracking_order_idx on order_tracking (order_id, occurred_at);

-- ---------------------------------------------------------------------------
-- 8. Payments, refunds and settlement
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  scope               text not null default 'order' check (scope in ('order','subscription')),
  provider            text not null default 'sandbox' check (provider in ('paystack','flutterwave','manual','sandbox')),
  provider_reference  text,
  checkout_reference  text,
  store_id            uuid references stores(id) on delete set null,
  order_id            uuid references orders(id) on delete set null,
  subscription_id     uuid references subscriptions(id) on delete set null,
  plan_id             uuid references subscription_plans(id) on delete set null,
  payer_user_id       uuid references users(id) on delete set null,
  payer_email         text not null,
  amount              numeric(14,2) not null check (amount >= 0),
  currency            text not null default 'NGN',
  status              text not null default 'pending'
                      check (status in ('pending','success','failed','abandoned','refunded')),
  channel             text,
  authorization_url   text,
  paid_at             timestamptz,
  verified_at         timestamptz,
  failure_reason      text,
  metadata            jsonb not null default '{}'::jsonb,
  raw                 jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists payments_scope_idx on payments (scope, status);
create index if not exists payments_email_idx on payments (lower(payer_email));
create index if not exists payments_store_idx on payments (store_id);
create index if not exists payments_checkout_idx on payments (checkout_reference);

drop trigger if exists payments_set_updated_at on payments;
create trigger payments_set_updated_at before update on payments
for each row execute function set_updated_at();

create table if not exists payment_allocations (
  id        uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  order_id   uuid not null references orders(id) on delete cascade,
  store_id   uuid not null references stores(id),
  amount     numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (payment_id, order_id)
);

create table if not exists refunds (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid references payments(id) on delete set null,
  order_id          uuid references orders(id) on delete set null,
  store_id          uuid references stores(id) on delete set null,
  amount            numeric(14,2) not null,
  reason            text,
  status            text not null default 'requested'
                    check (status in ('requested','approved','rejected','processed')),
  gateway_reference text,
  requested_by      uuid references users(id) on delete set null,
  processed_by      uuid references users(id) on delete set null,
  processed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists vendor_balances (
  store_id             uuid primary key references stores(id) on delete cascade,
  pending_amount       numeric(14,2) not null default 0,
  available_amount     numeric(14,2) not null default 0,
  lifetime_gross       numeric(14,2) not null default 0,
  lifetime_commission  numeric(14,2) not null default 0,
  lifetime_refunds     numeric(14,2) not null default 0,
  last_payout_at       timestamptz,
  updated_at           timestamptz not null default now()
);

create table if not exists vendor_payouts (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  amount       numeric(14,2) not null,
  status       text not null default 'pending'
               check (status in ('pending','processing','paid','failed')),
  method       text,
  reference    text,
  notes        text,
  processed_by uuid references users(id) on delete set null,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists platform_commissions (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  store_id   uuid not null references stores(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  rate       numeric(5,2) not null,
  amount     numeric(14,2) not null,
  status     text not null default 'accrued' check (status in ('accrued','settled','refunded')),
  created_at timestamptz not null default now()
);

create table if not exists subscription_payments (
  id                 uuid primary key default gen_random_uuid(),
  subscription_id    uuid references subscriptions(id) on delete set null,
  store_id           uuid not null references stores(id) on delete cascade,
  plan_id            uuid references subscription_plans(id) on delete set null,
  payment_id         uuid references payments(id) on delete set null,
  amount             numeric(14,2) not null,
  currency           text not null default 'NGN',
  days_added         integer not null default 0,
  old_expires_at     timestamptz,
  new_expires_at     timestamptz,
  status             text not null default 'pending'
                     check (status in ('pending','success','failed','refunded')),
  verification_method text check (verification_method in ('gateway','manual','admin_grant')),
  verified_by        uuid references users(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);
create index if not exists subscription_payments_store_idx on subscription_payments (store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. Communication, reviews and audit
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  store_id   uuid references stores(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  action_url text,
  read_at    timestamptz,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read_at);

create table if not exists email_logs (
  id                  uuid primary key default gen_random_uuid(),
  to_email            text not null,
  template            text not null,
  subject             text not null,
  html                text,
  text                text,
  status              text not null default 'queued'
                      check (status in ('queued','sent','failed','skipped')),
  provider            text not null default 'log',
  provider_message_id text,
  error               text,
  attempts            integer not null default 0,
  payload             jsonb not null default '{}'::jsonb,
  dedupe_key          text unique,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists email_logs_status_idx on email_logs (status, created_at desc);
create index if not exists email_logs_to_idx on email_logs (lower(to_email));

create table if not exists customer_messages (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid references stores(id) on delete cascade,
  order_id      uuid references orders(id) on delete set null,
  customer_id   uuid references users(id) on delete set null,
  sender_name   text not null,
  sender_email  text not null,
  sender_role   text not null default 'customer'
                check (sender_role in ('customer','vendor','admin')),
  category      text not null default 'inquiry'
                check (category in ('inquiry','order','support','dispute','review_report')),
  subject       text not null,
  body          text not null,
  status        text not null default 'open'
                check (status in ('open','awaiting_customer','resolved','closed')),
  parent_id     uuid references customer_messages(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists messages_store_idx on customer_messages (store_id, created_at desc);
create index if not exists messages_order_idx on customer_messages (order_id);

drop trigger if exists customer_messages_set_updated_at on customer_messages;
create trigger customer_messages_set_updated_at before update on customer_messages
for each row execute function set_updated_at();

create table if not exists reviews (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references stores(id) on delete cascade,
  product_id         uuid references products(id) on delete cascade,
  order_id           uuid references orders(id) on delete set null,
  customer_id        uuid references users(id) on delete set null,
  customer_name      text not null,
  customer_email     text not null,
  rating             integer not null check (rating between 1 and 5),
  title              text,
  comment            text,
  status             text not null default 'published'
                     check (status in ('published','pending','rejected')),
  verified_purchase  boolean not null default false,
  vendor_response    text,
  vendor_responded_at timestamptz,
  reported_count     integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists reviews_store_idx on reviews (store_id, status, created_at desc);
create index if not exists reviews_product_idx on reviews (product_id, status);
create unique index if not exists reviews_unique_order_product_idx
  on reviews (order_id, product_id) where order_id is not null and product_id is not null;
create unique index if not exists reviews_unique_order_store_idx
  on reviews (order_id) where order_id is not null and product_id is null;

drop trigger if exists reviews_set_updated_at on reviews;
create trigger reviews_set_updated_at before update on reviews
for each row execute function set_updated_at();

create table if not exists reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references users(id) on delete set null,
  reporter_email   text,
  store_id         uuid references stores(id) on delete cascade,
  review_id        uuid references reviews(id) on delete cascade,
  order_id         uuid references orders(id) on delete cascade,
  type             text not null default 'store'
                   check (type in ('store','review','order','payment','other')),
  reason           text not null,
  details          text,
  status           text not null default 'open'
                   check (status in ('open','investigating','resolved','dismissed')),
  resolution_note  text,
  resolved_by      uuid references users(id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists activity_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id) on delete set null,
  actor_role  text not null default 'system',
  store_id    uuid references stores(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  description text,
  ip          text,
  user_agent  text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_logs_created_idx on activity_logs (created_at desc);
create index if not exists activity_logs_store_idx on activity_logs (store_id, created_at desc);

create table if not exists scheduled_job_runs (
  id          uuid primary key default gen_random_uuid(),
  job_name    text not null,
  status      text not null default 'running' check (status in ('running','success','failed')),
  details     jsonb not null default '{}'::jsonb,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists job_runs_name_idx on scheduled_job_runs (job_name, started_at desc);

-- Read-only views mirroring the two audit streams named in the specification
create or replace view admin_activity_logs as
  select * from activity_logs where actor_role in ('admin','super_admin');
create or replace view vendor_activity_logs as
  select * from activity_logs where actor_role = 'vendor';

commit;
