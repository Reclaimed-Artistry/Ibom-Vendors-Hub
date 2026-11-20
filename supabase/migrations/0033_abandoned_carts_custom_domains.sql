-- ============================================================================
-- Ibom Vendors Hub — Abandoned cart recovery & vendor custom domains
-- ============================================================================
-- Migration 0033: idempotent, applied on every deploy via vercel-build
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Abandoned carts — track carts that were started but never completed
-- ----------------------------------------------------------------------------
create table if not exists abandoned_carts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  items_json    jsonb not null default '[]'::jsonb,
  subtotal      numeric(14,2) not null default 0,
  currency      text not null default 'NGN',
  checkout_reference text,
  recovered_at  timestamptz,
  recovery_sent boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists abandoned_carts_set_updated_at on abandoned_carts;
create trigger abandoned_carts_set_updated_at before update on abandoned_carts
for each row execute function set_updated_at();

create index if not exists abandoned_carts_email_idx on abandoned_carts(customer_email);
create index if not exists abandoned_carts_created_idx on abandoned_carts(created_at);
create index if not exists abandoned_carts_recovery_sent_idx on abandoned_carts(recovery_sent);

-- ----------------------------------------------------------------------------
-- 2. Vendor custom domains — allow vendors to map their own domain to a storefront
-- ----------------------------------------------------------------------------
alter table if exists stores
  add column if not exists custom_domain text;

create unique index if not exists stores_custom_domain_unique_idx
  on stores (lower(custom_domain))
  where custom_domain is not null and custom_domain <> '';

create table if not exists custom_domain_requests (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references stores(id) on delete cascade,
  requested_domain text not null,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected','verified')),
  admin_note     text,
  requested_at   timestamptz not null default now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid references users(id)
);

create index if not exists custom_domain_requests_store_idx on custom_domain_requests(store_id);
create index if not exists custom_domain_requests_status_idx on custom_domain_requests(status);

-- ----------------------------------------------------------------------------
-- RLS for abandoned_carts: customers see their own, admins see all
-- ----------------------------------------------------------------------------
alter table if exists abandoned_carts enable row level security;

create policy if not exists abandoned_carts_own on abandoned_carts
  for all to authenticated
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

create policy if not exists abandoned_carts_admin on abandoned_carts
  for all to authenticated
  using (
    exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin'))
  )
  with check (
    exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin'))
  );

-- ----------------------------------------------------------------------------
-- RLS for custom_domain_requests: vendors see their own, admins see all
-- ----------------------------------------------------------------------------
alter table if exists custom_domain_requests enable row level security;

create policy if not exists custom_domain_requests_own on custom_domain_requests
  for all to authenticated
  using (
    exists (select 1 from stores where id = store_id and owner_id = auth.uid())
  )
  with check (
    exists (select 1 from stores where id = store_id and owner_id = auth.uid())
  );

create policy if not exists custom_domain_requests_admin on custom_domain_requests
  for all to authenticated
  using (
    exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin'))
  )
  with check (
    exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin'))
  );

commit;

-- ============================================================================
-- Notes for the platform owner:
-- - Custom domains require DNS configuration (CNAME or A record) on your end.
--   The app stores the domain but does not terminate TLS or verify ownership.
-- - Abandoned cart recovery emails require SMTP to be configured
--   (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in Vercel env).
-- ============================================================================
