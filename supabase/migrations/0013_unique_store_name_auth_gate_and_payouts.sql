-- 0013_unique_store_name_auth_gate_and_payouts.sql
-- 1. Lock every vendor business name uniquely (case-insensitive, collapsed whitespace).
-- 2. Add Nigerian settlement bank account fields to `vendor_profiles` and `vendor_payouts`
--    so vendors configure where they receive escrow payouts and admins see exact bank details.

create or replace function normalise_business_name(p_name text) returns text
language sql immutable strict as $$
  select lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'));
$$;

grant execute on function normalise_business_name(text) to public, app_runtime;

create unique index if not exists stores_unique_business_name_idx
  on stores (normalise_business_name(name));

alter table vendor_profiles
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists account_name text;

alter table vendor_payouts
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists account_name text;
