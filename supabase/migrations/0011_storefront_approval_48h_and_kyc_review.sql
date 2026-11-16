-- 0011_storefront_approval_48h_and_kyc_review.sql
-- 1. Add 48-hour admin review deadline (`review_deadline_at`) to `stores`.
-- 2. Allow `store_approval` category (and `new` status) on `customer_messages` so new storefront
--    registrations deliver a dedicated 48-hour review message with uploaded KYC documents to Admin.
-- 3. Enable `require_vendor_approval = true` in `platform_settings` so every new storefront
--    undergoes mandatory document review before opening publicly.

alter table stores
  add column if not exists review_deadline_at timestamptz;

update stores
   set review_deadline_at = coalesce(review_deadline_at, created_at + interval '48 hours')
 where status = 'pending';

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'customer_messages'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%category%' or pg_get_constraintdef(oid) ilike '%status%')
  loop
    execute format('alter table customer_messages drop constraint %I', r.conname);
  end loop;
end $$;

alter table customer_messages
  add constraint customer_messages_category_check
    check (category in ('inquiry','order','support','dispute','review_report','store_approval')),
  add constraint customer_messages_status_check
    check (status in ('new','open','awaiting_customer','resolved','closed'));

update platform_settings
   set require_vendor_approval = true
 where id = 1;
