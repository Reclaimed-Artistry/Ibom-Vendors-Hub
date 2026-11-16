-- 0012_complete_store_and_product_deletion.sql
-- Ensure deleting a store or product removes it and all dependent store/product
-- records cleanly from the database without foreign-key restriction errors.

alter table orders
  drop constraint if exists orders_store_id_fkey,
  add constraint orders_store_id_fkey
    foreign key (store_id) references stores(id) on delete cascade;

alter table payment_allocations
  drop constraint if exists payment_allocations_store_id_fkey,
  add constraint payment_allocations_store_id_fkey
    foreign key (store_id) references stores(id) on delete cascade;

alter table inventory_movements
  drop constraint if exists inventory_movements_created_by_fkey,
  add constraint inventory_movements_created_by_fkey
    foreign key (created_by) references users(id) on delete set null;

alter table stores
  drop constraint if exists stores_suspended_by_fkey,
  add constraint stores_suspended_by_fkey
    foreign key (suspended_by) references users(id) on delete set null,
  drop constraint if exists stores_approved_by_fkey,
  add constraint stores_approved_by_fkey
    foreign key (approved_by) references users(id) on delete set null;

alter table subdomain_change_requests
  drop constraint if exists subdomain_change_requests_reviewed_by_fkey,
  add constraint subdomain_change_requests_reviewed_by_fkey
    foreign key (reviewed_by) references users(id) on delete set null;

alter table user_roles
  drop constraint if exists user_roles_granted_by_fkey,
  add constraint user_roles_granted_by_fkey
    foreign key (granted_by) references users(id) on delete set null;
