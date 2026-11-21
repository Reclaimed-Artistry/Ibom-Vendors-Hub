-- ============================================================================
-- Ibom Vendors Hub — Abandoned cart recovery
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
-- RLS for abandoned_carts: customers see their own, admins see all
-- ----------------------------------------------------------------------------
alter table if exists abandoned_carts enable row level security;

create policy abandoned_carts_own on abandoned_carts
  for all to app_runtime
  using (app_current_user_id() = user_id or user_id is null)
  with check (app_current_user_id() = user_id or user_id is null);

create policy abandoned_carts_admin on abandoned_carts
  for all to app_runtime
  using (
    exists (select 1 from users where id = app_current_user_id() and role in ('admin','super_admin'))
  )
  with check (
    exists (select 1 from users where id = app_current_user_id() and role in ('admin','super_admin'))
  );

commit;

-- ============================================================================
-- Notes for the platform owner:
-- - Abandoned cart recovery emails require SMTP to be configured
--   (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in Vercel env).
--   Cart tracking works without SMTP; recovery email delivery needs it.
-- ============================================================================
