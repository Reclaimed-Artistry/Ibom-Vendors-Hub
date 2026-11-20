begin;

-- Keep stores.category_id as the primary/default category for older clients.
-- A store can also belong to any number of additional marketplace categories.
create table store_category_assignments (
  store_id uuid not null references stores(id) on delete cascade,
  category_id uuid not null references store_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, category_id)
);
create index store_category_assignments_category_idx on store_category_assignments(category_id, store_id);
insert into store_category_assignments(store_id, category_id)
select id, category_id from stores where category_id is not null;

alter table store_category_assignments enable row level security;
grant select, insert, delete on store_category_assignments to app_runtime;
create policy store_category_assignments_read on store_category_assignments for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin() or store_is_live(store_id));
create policy store_category_assignments_insert on store_category_assignments for insert to app_runtime
  with check ((app_owns_store(store_id) or app_is_admin())
    and exists (select 1 from store_categories c where c.id = category_id and c.is_active));
create policy store_category_assignments_delete on store_category_assignments for delete to app_runtime
  using (app_owns_store(store_id) or app_is_admin());

-- Hiding a taxonomy option must not erase the transaction rules or fields on
-- existing listings. Only active categories appear in the selection catalogue.
drop policy categories_public_read on store_categories;
create policy categories_public_read on store_categories for select to app_runtime
  using (is_active or app_is_admin() or exists (
    select 1 from store_category_assignments a where a.category_id = store_categories.id
  ));

create function sync_store_primary_category() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.category_id is not null then
    if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
      and not exists (select 1 from store_categories c where c.id = new.category_id and c.is_active) then
      raise exception 'Choose an active primary business category';
    end if;
    insert into store_category_assignments(store_id,category_id)
    values(new.id,new.category_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function sync_store_primary_category() from public, app_runtime;
create trigger stores_sync_primary_category after insert or update of category_id on stores
for each row execute function sync_store_primary_category();

-- Deferred constraints allow an atomic primary-category change and whole-store
-- cascade deletion, but never leave an orphaned primary or listing category.
alter table stores add constraint stores_primary_category_membership_fk
  foreign key (id,category_id) references store_category_assignments(store_id,category_id)
  deferrable initially deferred;

-- products.category_id remains the vendor's private catalogue section (e.g.
-- Dresses or Custom boxes). This new column is the public marketplace category.
alter table products add column marketplace_category_id uuid references store_categories(id);
update products p set marketplace_category_id = s.category_id from stores s where s.id = p.store_id;
create index products_marketplace_category_idx on products(marketplace_category_id, store_id);
alter table products add constraint products_marketplace_category_membership_fk
  foreign key (store_id,marketplace_category_id) references store_category_assignments(store_id,category_id)
  deferrable initially deferred;

create function default_product_marketplace_category() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.marketplace_category_id is null then
    select category_id into new.marketplace_category_id from stores where id = new.store_id;
  end if;
  if new.marketplace_category_id is not null
    and (tg_op = 'INSERT' or new.marketplace_category_id is distinct from old.marketplace_category_id)
    and not exists (select 1 from store_categories c where c.id = new.marketplace_category_id and c.is_active) then
    raise exception 'Choose an active marketplace category';
  end if;
  if new.category_id is not null and not exists (
    select 1 from product_categories pc where pc.id = new.category_id and pc.store_id = new.store_id
  ) then
    raise exception 'Choose a catalogue section belonging to your own store';
  end if;
  return new;
end;
$$;
revoke all on function default_product_marketplace_category() from public, app_runtime;
create trigger products_default_marketplace_category
before insert or update of store_id, category_id, marketplace_category_id on products
for each row execute function default_product_marketplace_category();

-- Keep an order's workflow tied to the category at purchase time, even if its
-- product is later recategorised or deleted from the catalogue.
alter table order_items add column marketplace_category_id uuid references store_categories(id) on delete set null;
update order_items oi set marketplace_category_id = coalesce(p.marketplace_category_id,s.category_id)
  from orders o join stores s on s.id = o.store_id
  left join products p on p.store_id = s.id
  where oi.order_id = o.id and oi.product_id = p.id;
update order_items oi set marketplace_category_id = s.category_id
  from orders o join stores s on s.id = o.store_id
  where oi.order_id = o.id and oi.marketplace_category_id is null;

create function default_order_item_marketplace_category() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.marketplace_category_id is null then
    select coalesce(p.marketplace_category_id,s.category_id) into new.marketplace_category_id
      from orders o join stores s on s.id = o.store_id
      left join products p on p.id = new.product_id and p.store_id = s.id
      where o.id = new.order_id;
  end if;
  return new;
end;
$$;
revoke all on function default_order_item_marketplace_category() from public, app_runtime;
create trigger order_items_default_marketplace_category before insert on order_items
for each row execute function default_order_item_marketplace_category();

commit;
