-- ---------------------------------------------------------------------------
-- 0007 · Flash / splash announcements
--
-- A single table carries three kinds of message through the ticker that runs
-- under the header:
--
--   scope = 'platform', audience = 'vendors'    admin → every vendor
--   scope = 'platform', audience = 'customers'  admin → every shopper
--   scope = 'store',    audience = 'customers'  vendor → that store's shoppers
--
-- Vendors can attach products to a store announcement (a flash sale or a
-- clearance), which the ticker uses to link straight to what is on offer.
-- ---------------------------------------------------------------------------

create table if not exists announcements (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null default 'store' check (scope in ('platform','store')),
  store_id    uuid references stores(id) on delete cascade,
  audience    text not null default 'customers' check (audience in ('vendors','customers','everyone')),
  kind        text not null default 'info' check (kind in ('info','warning','success','flash_sale','clearance')),
  title       text not null,
  message     text not null,
  link_url    text,
  cta_label   text,
  is_active   boolean not null default true,
  priority    integer not null default 0,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint announcements_scope_store check (
    (scope = 'platform' and store_id is null) or (scope = 'store' and store_id is not null)
  )
);

create index if not exists announcements_live_idx
  on announcements (is_active, audience, starts_at desc);
create index if not exists announcements_store_idx
  on announcements (store_id, is_active desc, starts_at desc);

drop trigger if exists announcements_set_updated_at on announcements;
create trigger announcements_set_updated_at before update on announcements
for each row execute function set_updated_at();

create table if not exists announcement_products (
  announcement_id uuid not null references announcements(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  primary key (announcement_id, product_id)
);

create index if not exists announcement_products_product_idx
  on announcement_products (product_id);

alter table announcements enable row level security;
alter table announcement_products enable row level security;

-- Anything that is live, in its time window, and addressed to the reader.
drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements for select to app_runtime
  using (
    is_active
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (
      (scope = 'platform' and (
        audience = 'everyone'
        or (audience = 'vendors' and app_current_role() in ('vendor','admin','super_admin'))
        or (audience = 'customers' and app_current_role() in ('customer','admin','super_admin'))
        -- Anonymous shoppers browse the marketplace too.
        or (audience = 'customers' and app_current_role() = 'anon')
      ))
      -- Storefront notices are public by nature (they appear under the store header).
      or (scope = 'store' and audience in ('customers','everyone'))
    )
  );

-- Authors manage their own rows; admins manage everything. Application code
-- still goes through guarded server actions, this is defence in depth.
drop policy if exists announcements_insert on announcements;
create policy announcements_insert on announcements for insert to app_runtime
  with check (app_is_admin() or (scope = 'store' and app_owns_store(store_id)));

drop policy if exists announcements_update on announcements;
create policy announcements_update on announcements for update to app_runtime
  using (app_is_admin() or (scope = 'store' and app_owns_store(store_id)))
  with check (app_is_admin() or (scope = 'store' and app_owns_store(store_id)));

drop policy if exists announcements_delete on announcements;
create policy announcements_delete on announcements for delete to app_runtime
  using (app_is_admin() or (scope = 'store' and app_owns_store(store_id)));

drop policy if exists announcement_products_read on announcement_products;
create policy announcement_products_read on announcement_products for select to app_runtime
  using (
    exists (
      select 1 from announcements a
      where a.id = announcement_id
        and a.is_active
        and a.starts_at <= now()
        and (a.ends_at is null or a.ends_at > now())
        and (a.scope = 'store' or a.audience in ('customers','everyone'))
    )
  );

drop policy if exists announcement_products_write on announcement_products;
create policy announcement_products_write on announcement_products for all to app_runtime
  using (
    exists (
      select 1 from announcements a
      where a.id = announcement_id and (app_is_admin() or app_owns_store(a.store_id))
    )
  )
  with check (
    exists (
      select 1 from announcements a
      where a.id = announcement_id and (app_is_admin() or app_owns_store(a.store_id))
    )
  );
