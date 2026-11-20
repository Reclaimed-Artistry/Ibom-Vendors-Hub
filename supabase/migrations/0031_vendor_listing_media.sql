-- Listing media use direct, store-scoped uploads, not the server-action body.
-- Keep product_images and its existing URLs/ordering for backwards compatibility.
create table if not exists vendor_media_uploads (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  object_path text not null unique,
  url text not null unique,
  mime_type text not null check (mime_type in (
    'image/jpeg','image/png','image/webp','image/gif','image/avif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/wav','audio/ogg','audio/mp4'
  )),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 104857600),
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);
create index if not exists vendor_media_uploads_store_idx on vendor_media_uploads(store_id, created_at);
create index if not exists vendor_media_uploads_expiry_idx on vendor_media_uploads(expires_at);
alter table vendor_media_uploads enable row level security;
grant select on vendor_media_uploads to app_runtime;
drop policy if exists vendor_media_uploads_read on vendor_media_uploads;
create policy vendor_media_uploads_read on vendor_media_uploads for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());
-- No client/actor write policy. Only trusted server code can issue or verify an upload.

alter table product_images add column if not exists mime_type text;
alter table product_images add column if not exists byte_size bigint check (byte_size > 0 and byte_size <= 104857600);
alter table product_images add column if not exists upload_id uuid references vendor_media_uploads(id) on delete set null;
create index if not exists product_images_upload_idx on product_images(upload_id) where upload_id is not null;

create or replace function guard_product_media_reference() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  upload vendor_media_uploads%rowtype;
  attaching boolean := true;
begin
  if new.upload_id is null then
    if exists (select 1 from vendor_media_uploads u
                where u.url = split_part(split_part(new.url, '?', 1), '#', 1)) then
      raise exception 'Use the verified upload ID for this media';
    end if;
    return new;
  end if;

  -- Serialise attachments with cleanup. Cleanup claims an unreferenced receipt
  -- as failed before deleting its object, so a concurrent save cannot attach it.
  select u.* into upload from vendor_media_uploads u where u.id = new.upload_id for share;
  if not found or upload.store_id is distinct from (select store_id from products where id = new.product_id)
     or upload.status <> 'ready' or upload.url is distinct from new.url
     or upload.mime_type is distinct from new.mime_type or upload.byte_size is distinct from new.byte_size then
    raise exception 'Media must be a verified upload belonging to this store';
  end if;
  if tg_op = 'UPDATE' then
    attaching := old.upload_id is distinct from new.upload_id
                 or old.product_id is distinct from new.product_id;
  end if;
  -- Expiry limits new attachments, not edits to media already in a listing.
  if attaching and upload.expires_at <= clock_timestamp() then
    raise exception 'This media upload has expired. Choose the file again.';
  end if;
  return new;
end;
$$;
drop trigger if exists product_media_reference_guard on product_images;
create trigger product_media_reference_guard before insert or update on product_images
for each row execute function guard_product_media_reference();

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    update storage.buckets
       set file_size_limit = 104857600,
           allowed_mime_types = array[
             'image/jpeg','image/jpg','image/png','image/webp','image/gif','image/avif','image/svg+xml',
             'video/mp4','video/webm','video/quicktime',
             'audio/mpeg','audio/wav','audio/ogg','audio/mp4','application/pdf'
           ]
     where id = 'storefronts';
  end if;
end $$;
