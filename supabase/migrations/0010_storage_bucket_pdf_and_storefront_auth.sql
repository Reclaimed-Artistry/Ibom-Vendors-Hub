-- 0010_storage_bucket_pdf_and_storefront_auth.sql
-- 1. Ensure Supabase Storage bucket `storefronts` accepts PDF and image Proof of Residence uploads up to 10 MB.
-- 2. Allow trusted system connections (current_user <> 'app_runtime' or app.user_role = 'system')
--    to update protected user fields (password reset, email verification, customer-to-vendor upgrade)
--    while keeping `app_runtime` actor contexts strictly guarded.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    update storage.buckets
       set file_size_limit = greatest(coalesce(file_size_limit, 0), 10485760),
           allowed_mime_types = array[
             'image/jpeg',
             'image/jpg',
             'image/png',
             'image/webp',
             'image/gif',
             'image/svg+xml',
             'application/pdf'
           ]
     where id = 'storefronts';
  end if;
end $$;

create or replace function guard_user_columns() returns trigger
language plpgsql as $$
declare v_role text := app_current_role();
begin
  if current_user = 'app_runtime' and v_role in ('vendor', 'customer', 'anon') then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.email_verified_at is distinct from old.email_verified_at
       or new.password_hash is distinct from old.password_hash then
      raise exception 'Protected account fields cannot be modified from this context';
    end if;
  end if;
  return new;
end;
$$;
