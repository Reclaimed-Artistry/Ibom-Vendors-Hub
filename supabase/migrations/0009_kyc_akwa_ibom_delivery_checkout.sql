-- ============================================================================
-- 0009 — Vendor KYC (NIN, Proof of Residence, CAC), Akwa Ibom State Locality,
--        Delivery PIN / Two-Way Fulfilment Verification, & Verified Reviews
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Vendor KYC columns on vendor_profiles
-- ---------------------------------------------------------------------------
alter table vendor_profiles
  add column if not exists proof_of_residence_url  text,
  add column if not exists proof_of_residence_type text,
  add column if not exists cac_registered          boolean not null default false,
  add column if not exists cac_number              text,
  add column if not exists kyc_status              text not null default 'submitted',
  add column if not exists kyc_note                text;

alter table vendor_profiles
  drop constraint if exists vendor_profiles_kyc_status_check;
alter table vendor_profiles
  add constraint vendor_profiles_kyc_status_check
  check (kyc_status in ('pending', 'submitted', 'verified', 'rejected'));

alter table vendor_profiles
  drop constraint if exists vendor_profiles_cac_number_check;
alter table vendor_profiles
  add constraint vendor_profiles_cac_number_check
  check (
    cac_registered = false
    or (cac_number is not null and length(trim(cac_number)) >= 4)
  );

create or replace function guard_vendor_profile_columns() returns trigger
language plpgsql as $$
declare v_role text := app_current_role();
begin
  if v_role in ('vendor', 'customer', 'anon') then
    if new.verified_at is distinct from old.verified_at
       or new.kyc_status is distinct from old.kyc_status
       or new.kyc_note is distinct from old.kyc_note then
      raise exception 'Protected vendor verification fields cannot be modified from this context';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_profiles_guard_columns on vendor_profiles;
create trigger vendor_profiles_guard_columns before update on vendor_profiles
for each row execute function guard_vendor_profile_columns();

-- ---------------------------------------------------------------------------
-- 2. Enforce Akwa Ibom State for every vendor store
-- ---------------------------------------------------------------------------
update stores
   set state = 'Akwa Ibom'
 where state is null
    or lower(trim(state)) not in ('akwa ibom', 'akwa ibom state');

alter table stores
  alter column state set default 'Akwa Ibom',
  alter column state set not null;

create or replace function normalize_store_akwa_ibom() returns trigger
language plpgsql as $$
begin
  if new.state is null or trim(new.state) = '' then
    new.state := 'Akwa Ibom';
  elsif lower(trim(new.state)) in ('akwa ibom', 'akwa ibom state') then
    new.state := 'Akwa Ibom';
  else
    raise exception 'Every vendor on Ibom Vendors Hub must be located in Akwa Ibom State';
  end if;
  return new;
end;
$$;

drop trigger if exists stores_normalize_akwa_ibom on stores;
create trigger stores_normalize_akwa_ibom before insert or update on stores
for each row execute function normalize_store_akwa_ibom();

alter table stores
  drop constraint if exists stores_akwa_ibom_state_check;
alter table stores
  add constraint stores_akwa_ibom_state_check
  check (lower(trim(state)) in ('akwa ibom', 'akwa ibom state'));

-- ---------------------------------------------------------------------------
-- 3. Delivery verification PIN, handover proof & payout escrow guard on orders
-- ---------------------------------------------------------------------------
create or replace function generate_delivery_pin() returns text
language sql volatile as $$
  select lpad((floor(random() * 900000)::int + 100000)::text, 6, '0');
$$;

alter table orders
  add column if not exists delivery_pin          text not null default generate_delivery_pin(),
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists delivery_confirmed_by text,
  add column if not exists dispatch_rider_name   text,
  add column if not exists dispatch_rider_phone  text,
  add column if not exists pickup_location       text,
  add column if not exists payout_released       boolean not null default false,
  add column if not exists dispute_status        text not null default 'none',
  add column if not exists dispute_reason        text;

alter table orders
  drop constraint if exists orders_delivery_confirmed_by_check;
alter table orders
  add constraint orders_delivery_confirmed_by_check
  check (delivery_confirmed_by is null or delivery_confirmed_by in ('pin', 'customer', 'admin'));

alter table orders
  drop constraint if exists orders_dispute_status_check;
alter table orders
  add constraint orders_dispute_status_check
  check (dispute_status in ('none', 'open', 'resolved', 'refunded'));

update orders
   set delivery_confirmed_at = coalesce(delivery_confirmed_at, completed_at, delivered_at, updated_at),
       delivery_confirmed_by = coalesce(delivery_confirmed_by, 'customer'),
       payout_released = true
 where status in ('delivered', 'completed')
   and payout_released = false;

-- ---------------------------------------------------------------------------
-- 4. Logged-in verified purchase reviews & SECURITY DEFINER rating aggregates
-- ---------------------------------------------------------------------------
create or replace function refresh_review_ratings() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_store uuid; v_product uuid;
begin
  v_store := coalesce(new.store_id, old.store_id);
  v_product := coalesce(new.product_id, old.product_id);

  update stores s set
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from reviews r
                            where r.store_id = s.id and r.status = 'published'), 0),
    rating_count = (select count(*) from reviews r where r.store_id = s.id and r.status = 'published')
  where s.id = v_store;

  if v_product is not null then
    update products p set
      rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from reviews r
                              where r.product_id = p.id and r.status = 'published'), 0),
      rating_count = (select count(*) from reviews r where r.product_id = p.id and r.status = 'published')
    where p.id = v_product;
  end if;

  return null;
end;
$$;

drop policy if exists reviews_insert_verified on reviews;
create policy reviews_insert_verified on reviews for insert to app_runtime
  with check (
    app_current_user_id() is not null
    and customer_id = app_current_user_id()
    and store_id is not null
    and exists (
      select 1 from orders o
      where o.store_id = reviews.store_id
        and (reviews.order_id is null or o.id = reviews.order_id)
        and (o.customer_id = app_current_user_id()
             or lower(o.customer_email) = app_current_user_email())
        and o.status in ('delivered', 'completed')
        and (
          reviews.product_id is null
          or exists (
            select 1 from order_items oi
            where oi.order_id = o.id
              and oi.product_id = reviews.product_id
          )
        )
    )
  );

commit;
