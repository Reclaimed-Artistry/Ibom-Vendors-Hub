-- ============================================================================
-- Ibom Vendors Hub — Row Level Security & tenant isolation
-- ----------------------------------------------------------------------------
-- Every request handled by the application server opens a transaction and runs:
--    set local role app_runtime;
--    select set_config('app.user_id',   '<uuid or empty>', true);
--    select set_config('app.user_email','<email>',        true);
--    select set_config('app.user_role', '<role|anon>',    true);
-- so all queries below are evaluated against a *real* database role that is
-- subject to RLS. Background jobs, auth and payment webhooks use the owning
-- connection (system) and therefore bypass RLS by design.
-- ============================================================================

begin;

-- Runtime role ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime nologin;
  end if;
end $$;

-- On managed Postgres (Supabase, RDS) the application connects as a non-superuser
-- such as `postgres`, which must be a member of app_runtime *with the SET
-- option* to run `set local role`. A plain GRANT can land with SET disabled on
-- managed platforms, so the options are always spelled out (0005 re-runs this
-- for databases that were migrated earlier).
do $$
declare
  opts text := case
    when current_setting('server_version_num')::int >= 160000
      then ' with admin false, inherit true, set true'
    else ''
  end;
begin
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    execute format('grant app_runtime to postgres%s', opts);
  end if;
  execute format('grant app_runtime to %I%s', current_user, opts);
end $$;

grant usage on schema public to app_runtime;
grant select, insert, update, delete on all tables in schema public to app_runtime;
grant usage, select on all sequences in schema public to app_runtime;
grant execute on all functions in schema public to app_runtime;
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_runtime;
alter default privileges in schema public
  grant usage, select on sequences to app_runtime;
alter default privileges in schema public
  grant execute on functions to app_runtime;

-- Session helpers ------------------------------------------------------------
create or replace function app_current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function app_current_user_email() returns text
language sql stable as $$
  select lower(nullif(current_setting('app.user_email', true), ''));
$$;

create or replace function app_current_role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('app.user_role', true), ''), 'anon');
$$;

create or replace function app_is_admin() returns boolean
language sql stable as $$
  select app_current_role() in ('admin', 'super_admin');
$$;

-- Stores owned by the current user (SECURITY DEFINER: no recursive RLS) ------
create or replace function app_owned_store_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from stores where owner_id = app_current_user_id();
$$;

create or replace function app_owns_store(p_store uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from stores where id = p_store and owner_id = app_current_user_id()
  );
$$;

-- A storefront is publicly live only when it is approved, not manually
-- suspended, public, AND under an active subscription or admin-granted access.
create or replace function store_is_live(p_store uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from stores s
    where s.id = p_store
      and s.status = 'active'
      and s.manual_suspension = false
      and s.visibility = 'public'
      and (
        (s.access_until is not null and s.access_until > now())
        or exists (
          select 1 from subscriptions su
          where su.store_id = s.id
            and su.status in ('active', 'trialing')
            and su.expires_at > now()
        )
      )
  );
$$;

-- Enable RLS on every tenant table -------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'users','user_roles','auth_tokens','vendor_profiles','customer_profiles','delivery_addresses',
    'platform_settings','store_categories','stores','store_domains','reserved_subdomains',
    'subdomain_change_requests','subscription_plans','subscriptions','subscription_history',
    'subscription_payments','product_categories','products','product_images','product_variants',
    'product_addons','inventory_movements','service_bookings','service_quotations',
    'service_attachments','orders','order_items','order_status_history','order_tracking',
    'payments','payment_allocations','refunds','vendor_balances','vendor_payouts',
    'platform_commissions','notifications','email_logs','customer_messages','reviews','reports',
    'activity_logs','scheduled_job_runs'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

alter view admin_activity_logs set (security_invoker = true);
alter view vendor_activity_logs set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
drop policy if exists users_select_self_or_admin on users;
create policy users_select_self_or_admin on users for select to app_runtime
  using (id = app_current_user_id() or app_is_admin());

drop policy if exists users_update_self_or_admin on users;
create policy users_update_self_or_admin on users for update to app_runtime
  using (id = app_current_user_id() or app_is_admin())
  with check (id = app_current_user_id() or app_is_admin());

drop policy if exists user_roles_select on user_roles;
create policy user_roles_select on user_roles for select to app_runtime
  using (user_id = app_current_user_id() or app_is_admin());

drop policy if exists vendor_profiles_select on vendor_profiles;
create policy vendor_profiles_select on vendor_profiles for select to app_runtime
  using (user_id = app_current_user_id() or app_is_admin());
drop policy if exists vendor_profiles_write on vendor_profiles;
create policy vendor_profiles_write on vendor_profiles for insert to app_runtime
  with check (user_id = app_current_user_id());
drop policy if exists vendor_profiles_update on vendor_profiles;
create policy vendor_profiles_update on vendor_profiles for update to app_runtime
  using (user_id = app_current_user_id() or app_is_admin())
  with check (user_id = app_current_user_id() or app_is_admin());

drop policy if exists customer_profiles_select on customer_profiles;
create policy customer_profiles_select on customer_profiles for select to app_runtime
  using (user_id = app_current_user_id() or app_is_admin());
drop policy if exists customer_profiles_write on customer_profiles;
create policy customer_profiles_write on customer_profiles for insert to app_runtime
  with check (user_id = app_current_user_id());
drop policy if exists customer_profiles_update on customer_profiles;
create policy customer_profiles_update on customer_profiles for update to app_runtime
  using (user_id = app_current_user_id() or app_is_admin())
  with check (user_id = app_current_user_id() or app_is_admin());

drop policy if exists addresses_all on delivery_addresses;
create policy addresses_all on delivery_addresses for all to app_runtime
  using (user_id = app_current_user_id() or app_is_admin())
  with check (user_id = app_current_user_id());

-- Platform settings: readable/writable by admins only. Public settings are
-- read through the system connection by server components.
drop policy if exists settings_admin on platform_settings;
create policy settings_admin on platform_settings for all to app_runtime
  using (app_is_admin()) with check (app_is_admin());

-- ---------------------------------------------------------------------------
-- Categories & stores
-- ---------------------------------------------------------------------------
drop policy if exists categories_public_read on store_categories;
create policy categories_public_read on store_categories for select to app_runtime
  using (is_active or app_is_admin());
drop policy if exists categories_admin_write on store_categories;
create policy categories_admin_write on store_categories for all to app_runtime
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists stores_read on stores;
create policy stores_read on stores for select to app_runtime
  using (app_owns_store(id) or app_is_admin() or store_is_live(id));

drop policy if exists stores_vendor_update on stores;
create policy stores_vendor_update on stores for update to app_runtime
  using (app_owns_store(id) or app_is_admin())
  with check (app_owns_store(id) or app_is_admin());

drop policy if exists stores_admin_delete on stores;
create policy stores_admin_delete on stores for delete to app_runtime
  using (app_is_admin());

drop policy if exists domains_read on store_domains;
create policy domains_read on store_domains for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin() or store_is_live(store_id));

drop policy if exists domains_admin_write on store_domains;
create policy domains_admin_write on store_domains for all to app_runtime
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists reserved_read on reserved_subdomains;
create policy reserved_read on reserved_subdomains for select to app_runtime using (true);
drop policy if exists reserved_admin_write on reserved_subdomains;
create policy reserved_admin_write on reserved_subdomains for all to app_runtime
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists subdomain_requests_read on subdomain_change_requests;
create policy subdomain_requests_read on subdomain_change_requests for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());
drop policy if exists subdomain_requests_insert on subdomain_change_requests;
create policy subdomain_requests_insert on subdomain_change_requests for insert to app_runtime
  with check (app_owns_store(store_id));
drop policy if exists subdomain_requests_admin_update on subdomain_change_requests;
create policy subdomain_requests_admin_update on subdomain_change_requests for update to app_runtime
  using (app_is_admin()) with check (app_is_admin());

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
drop policy if exists plans_read on subscription_plans;
create policy plans_read on subscription_plans for select to app_runtime
  using (is_active or app_is_admin());
drop policy if exists plans_admin_write on subscription_plans;
create policy plans_admin_write on subscription_plans for all to app_runtime
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists subscriptions_read on subscriptions;
create policy subscriptions_read on subscriptions for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());
drop policy if exists subscriptions_admin_update on subscriptions;
create policy subscriptions_admin_update on subscriptions for update to app_runtime
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists subscription_history_read on subscription_history;
create policy subscription_history_read on subscription_history for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());

drop policy if exists subscription_payments_read on subscription_payments;
create policy subscription_payments_read on subscription_payments for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
drop policy if exists product_categories_read on product_categories;
create policy product_categories_read on product_categories for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin() or store_is_live(store_id));
drop policy if exists product_categories_write on product_categories;
create policy product_categories_write on product_categories for all to app_runtime
  using (app_owns_store(store_id) or app_is_admin())
  with check (app_owns_store(store_id) or app_is_admin());

drop policy if exists products_read on products;
create policy products_read on products for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin() or store_is_live(store_id));
drop policy if exists products_write on products;
create policy products_write on products for all to app_runtime
  using (app_owns_store(store_id) or app_is_admin())
  with check (app_owns_store(store_id) or app_is_admin());

drop policy if exists product_images_read on product_images;
create policy product_images_read on product_images for select to app_runtime
  using (exists (select 1 from products p where p.id = product_id));
drop policy if exists product_images_write on product_images;
create policy product_images_write on product_images for all to app_runtime
  using (exists (select 1 from products p where p.id = product_id and app_owns_store(p.store_id)))
  with check (exists (select 1 from products p where p.id = product_id and app_owns_store(p.store_id)));

drop policy if exists product_variants_read on product_variants;
create policy product_variants_read on product_variants for select to app_runtime
  using (exists (select 1 from products p where p.id = product_id));
drop policy if exists product_variants_write on product_variants;
create policy product_variants_write on product_variants for all to app_runtime
  using (exists (select 1 from products p where p.id = product_id and app_owns_store(p.store_id)))
  with check (exists (select 1 from products p where p.id = product_id and app_owns_store(p.store_id)));

drop policy if exists product_addons_read on product_addons;
create policy product_addons_read on product_addons for select to app_runtime
  using (exists (select 1 from products p where p.id = product_id));
drop policy if exists product_addons_write on product_addons;
create policy product_addons_write on product_addons for all to app_runtime
  using (exists (select 1 from products p where p.id = product_id and app_owns_store(p.store_id)))
  with check (exists (select 1 from products p where p.id = product_id and app_owns_store(p.store_id)));

drop policy if exists inventory_read on inventory_movements;
create policy inventory_read on inventory_movements for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
drop policy if exists bookings_read on service_bookings;
create policy bookings_read on service_bookings for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin()
         or customer_id = app_current_user_id()
         or lower(customer_email) = app_current_user_email());
drop policy if exists bookings_update on service_bookings;
create policy bookings_update on service_bookings for update to app_runtime
  using (app_owns_store(store_id) or app_is_admin())
  with check (app_owns_store(store_id) or app_is_admin());

drop policy if exists quotations_read on service_quotations;
create policy quotations_read on service_quotations for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin()
         or customer_id = app_current_user_id()
         or lower(customer_email) = app_current_user_email());
drop policy if exists quotations_update on service_quotations;
create policy quotations_update on service_quotations for update to app_runtime
  using (app_owns_store(store_id) or app_is_admin())
  with check (app_owns_store(store_id) or app_is_admin());

drop policy if exists attachments_read on service_attachments;
create policy attachments_read on service_attachments for select to app_runtime
  using (exists (select 1 from service_quotations q where q.id = quotation_id));

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
drop policy if exists orders_read on orders;
create policy orders_read on orders for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin()
         or customer_id = app_current_user_id()
         or lower(customer_email) = app_current_user_email());

drop policy if exists orders_vendor_update on orders;
create policy orders_vendor_update on orders for update to app_runtime
  using (app_owns_store(store_id) or app_is_admin())
  with check (app_owns_store(store_id) or app_is_admin());

drop policy if exists order_items_read on order_items;
create policy order_items_read on order_items for select to app_runtime
  using (exists (select 1 from orders o where o.id = order_id));

drop policy if exists order_history_read on order_status_history;
create policy order_history_read on order_status_history for select to app_runtime
  using (exists (select 1 from orders o where o.id = order_id));

drop policy if exists order_history_insert on order_status_history;
create policy order_history_insert on order_status_history for insert to app_runtime
  with check (exists (select 1 from orders o where o.id = order_id and (app_owns_store(o.store_id) or app_is_admin())));

drop policy if exists order_tracking_read on order_tracking;
create policy order_tracking_read on order_tracking for select to app_runtime
  using (exists (select 1 from orders o where o.id = order_id));

drop policy if exists order_tracking_insert on order_tracking;
create policy order_tracking_insert on order_tracking for insert to app_runtime
  with check (exists (select 1 from orders o where o.id = order_id and (app_owns_store(o.store_id) or app_is_admin())));

-- ---------------------------------------------------------------------------
-- Payments & settlement
-- ---------------------------------------------------------------------------
drop policy if exists payments_read on payments;
create policy payments_read on payments for select to app_runtime
  using (app_is_admin()
         or payer_user_id = app_current_user_id()
         or lower(payer_email) = app_current_user_email()
         or (store_id is not null and app_owns_store(store_id))
         or (order_id is not null and exists (select 1 from orders o where o.id = order_id)));

drop policy if exists payments_admin_update on payments;
create policy payments_admin_update on payments for update to app_runtime
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists allocations_read on payment_allocations;
create policy allocations_read on payment_allocations for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin()
         or exists (select 1 from payments p where p.id = payment_id));

drop policy if exists refunds_read on refunds;
create policy refunds_read on refunds for select to app_runtime
  using (app_is_admin()
         or (store_id is not null and app_owns_store(store_id))
         or (order_id is not null and exists (select 1 from orders o where o.id = order_id)));

drop policy if exists refunds_vendor_request on refunds;
create policy refunds_vendor_request on refunds for insert to app_runtime
  with check (app_is_admin() or (store_id is not null and app_owns_store(store_id)));

drop policy if exists refunds_admin_update on refunds;
create policy refunds_admin_update on refunds for update to app_runtime
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists balances_read on vendor_balances;
create policy balances_read on vendor_balances for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());

drop policy if exists payouts_read on vendor_payouts;
create policy payouts_read on vendor_payouts for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());

drop policy if exists commissions_read on platform_commissions;
create policy commissions_read on platform_commissions for select to app_runtime
  using (app_owns_store(store_id) or app_is_admin());

-- ---------------------------------------------------------------------------
-- Reviews & reports
-- ---------------------------------------------------------------------------
drop policy if exists reviews_read on reviews;
create policy reviews_read on reviews for select to app_runtime
  using (status = 'published' or app_is_admin() or app_owns_store(store_id)
         or customer_id = app_current_user_id()
         or lower(customer_email) = app_current_user_email());

drop policy if exists reviews_insert_verified on reviews;
create policy reviews_insert_verified on reviews for insert to app_runtime
  with check (
    customer_id = app_current_user_id()
    and store_id is not null
    and (
      exists (
        select 1 from orders o
        where o.store_id = reviews.store_id
          and (o.customer_id = app_current_user_id()
               or lower(o.customer_email) = app_current_user_email())
          and o.status in ('delivered', 'completed', 'in_service')
      )
    )
  );

drop policy if exists reviews_update on reviews;
create policy reviews_update on reviews for update to app_runtime
  using (app_is_admin() or app_owns_store(store_id) or customer_id = app_current_user_id())
  with check (app_is_admin() or app_owns_store(store_id) or customer_id = app_current_user_id());

drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert to app_runtime
  with check (reporter_user_id = app_current_user_id()
              or lower(reporter_email) = app_current_user_email());
drop policy if exists reports_read on reports;
create policy reports_read on reports for select to app_runtime
  using (app_is_admin() or reporter_user_id = app_current_user_id());
drop policy if exists reports_admin_update on reports;
create policy reports_admin_update on reports for update to app_runtime
  using (app_is_admin()) with check (app_is_admin());

-- ---------------------------------------------------------------------------
-- Messaging, notifications, audit
-- ---------------------------------------------------------------------------
drop policy if exists messages_read on customer_messages;
create policy messages_read on customer_messages for select to app_runtime
  using (app_is_admin()
         or (store_id is not null and app_owns_store(store_id))
         or customer_id = app_current_user_id()
         or lower(sender_email) = app_current_user_email());

drop policy if exists messages_vendor_insert on customer_messages;
create policy messages_vendor_insert on customer_messages for insert to app_runtime
  with check (store_id is not null and app_owns_store(store_id));

drop policy if exists messages_update on customer_messages;
create policy messages_update on customer_messages for update to app_runtime
  using (app_is_admin() or (store_id is not null and app_owns_store(store_id)))
  with check (app_is_admin() or (store_id is not null and app_owns_store(store_id)));

drop policy if exists notifications_read on notifications;
create policy notifications_read on notifications for select to app_runtime
  using (user_id = app_current_user_id());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to app_runtime
  using (user_id = app_current_user_id()) with check (user_id = app_current_user_id());

drop policy if exists email_logs_admin on email_logs;
create policy email_logs_admin on email_logs for select to app_runtime
  using (app_is_admin());

drop policy if exists activity_read on activity_logs;
create policy activity_read on activity_logs for select to app_runtime
  using (app_is_admin() or (store_id is not null and app_owns_store(store_id)));

drop policy if exists job_runs_admin on scheduled_job_runs;
create policy job_runs_admin on scheduled_job_runs for select to app_runtime
  using (app_is_admin());

commit;
