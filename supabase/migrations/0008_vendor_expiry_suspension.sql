-- ============================================================================
-- 0008 · Vendor subscription expiry suspension & write-lock enforcement
--
-- Ensures that as soon as a vendor's subscription (or admin-granted access
-- window) expires:
--   1. process_subscription_expiry() suspends both 'active' and 'pending'
--      stores with status = 'expired' and records suspended_at.
--   2. store_has_vendor_access(store_id) gates every vendor write policy under
--      RLS so an expired or suspended vendor cannot mutate store data until
--      subscription renewal restores the store via apply_subscription_payment().
--   3. Storefront announcements from expired/suspended stores are hidden from
--      public shoppers automatically via store_is_live(store_id).
-- ============================================================================

begin;

-- Vendor operational access helper (true only while subscription/access is unexpired and not suspended)
create or replace function store_has_vendor_access(p_store uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from stores s
    where s.id = p_store
      and s.manual_suspension = false
      and s.status in ('active', 'pending')
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

grant execute on function store_has_vendor_access(uuid) to app_runtime;

-- Update automatic expiry processor so expired trials on pending stores also suspend cleanly
create or replace function process_subscription_expiry()
returns table (store_id uuid, subscription_id uuid, store_name text, owner_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
begin
  for r in
    select su.id, su.store_id, su.expires_at, su.status
      from subscriptions su
     where su.status in ('active', 'trialing')
       and su.expires_at <= now()
       for update
  loop
    update subscriptions set status = 'expired' where id = r.id;

    insert into subscription_history (subscription_id, store_id, from_status, to_status,
                                      from_expires_at, to_expires_at, note)
    values (r.id, r.store_id, r.status, 'expired', r.expires_at, r.expires_at, 'Automatic expiry — account suspended until renewal');

    update stores s
       set status = 'expired',
           suspension_reason = 'Subscription expired',
           suspended_at = coalesce(s.suspended_at, now())
     where s.id = r.store_id
       and s.manual_suspension = false
       and s.status in ('active', 'pending')
       and not (s.access_until is not null and s.access_until > now())
       and not exists (
         select 1 from subscriptions o
          where o.store_id = s.id and o.status in ('active','trialing') and o.expires_at > now()
       );

    insert into notifications (user_id, store_id, type, title, body, action_url, dedupe_key)
    select s.owner_id, s.id, 'subscription_expired', 'Account suspended — subscription expired',
           'Your subscription expired on ' || to_char(r.expires_at, 'DD Mon YYYY') ||
           '. Your vendor account and storefront are suspended until you renew.',
           '/vendor/subscription', 'sub-expired:' || r.id::text
      from stores s where s.id = r.store_id;

    insert into activity_logs (actor_role, store_id, action, entity_type, entity_id, description,
                               meta)
    select 'system', r.store_id, 'subscription.expired', 'subscription', r.id::text,
           'Subscription expired — vendor account suspended until renewal',
           jsonb_build_object('expires_at', r.expires_at)
      from stores s where s.id = r.store_id;

    store_id := r.store_id;
    subscription_id := r.id;
    expires_at := r.expires_at;
    select s.name, s.owner_id into store_name, owner_id from stores s where s.id = r.store_id;
    return next;
  end loop;

  -- Administrator-granted access periods that have ended (no active subscription)
  for r in
    update stores s
       set status = 'expired',
           suspension_reason = 'Access period ended',
           suspended_at = coalesce(s.suspended_at, now())
     where s.status in ('active', 'pending')
       and s.manual_suspension = false
       and s.access_until is not null
       and s.access_until <= now()
       and not exists (
         select 1 from subscriptions o
          where o.store_id = s.id and o.status in ('active','trialing') and o.expires_at > now()
       )
     returning s.id, s.name, s.owner_id, s.access_until
  loop
    store_id := r.id;
    subscription_id := null;
    store_name := r.name;
    owner_id := r.owner_id;
    expires_at := r.access_until;
    return next;
  end loop;
end;
$$;

revoke all on function process_subscription_expiry() from public;
revoke all on function process_subscription_expiry() from app_runtime;

-- Enforce active subscription on all vendor write policies
drop policy if exists stores_vendor_update on stores;
create policy stores_vendor_update on stores for update to app_runtime
  using (app_is_admin() or (app_owns_store(id) and store_has_vendor_access(id)))
  with check (app_is_admin() or (app_owns_store(id) and store_has_vendor_access(id)));

drop policy if exists subdomain_requests_insert on subdomain_change_requests;
create policy subdomain_requests_insert on subdomain_change_requests for insert to app_runtime
  with check (app_owns_store(store_id) and store_has_vendor_access(store_id));

drop policy if exists product_categories_write on product_categories;
create policy product_categories_write on product_categories for all to app_runtime
  using (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists products_write on products;
create policy products_write on products for all to app_runtime
  using (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists product_images_write on product_images;
create policy product_images_write on product_images for all to app_runtime
  using (exists (select 1 from products p where p.id = product_id and (app_is_admin() or (app_owns_store(p.store_id) and store_has_vendor_access(p.store_id)))))
  with check (exists (select 1 from products p where p.id = product_id and (app_is_admin() or (app_owns_store(p.store_id) and store_has_vendor_access(p.store_id)))));

drop policy if exists product_variants_write on product_variants;
create policy product_variants_write on product_variants for all to app_runtime
  using (exists (select 1 from products p where p.id = product_id and (app_is_admin() or (app_owns_store(p.store_id) and store_has_vendor_access(p.store_id)))))
  with check (exists (select 1 from products p where p.id = product_id and (app_is_admin() or (app_owns_store(p.store_id) and store_has_vendor_access(p.store_id)))));

drop policy if exists product_addons_write on product_addons;
create policy product_addons_write on product_addons for all to app_runtime
  using (exists (select 1 from products p where p.id = product_id and (app_is_admin() or (app_owns_store(p.store_id) and store_has_vendor_access(p.store_id)))))
  with check (exists (select 1 from products p where p.id = product_id and (app_is_admin() or (app_owns_store(p.store_id) and store_has_vendor_access(p.store_id)))));

drop policy if exists bookings_update on service_bookings;
create policy bookings_update on service_bookings for update to app_runtime
  using (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists quotations_update on service_quotations;
create policy quotations_update on service_quotations for update to app_runtime
  using (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists orders_vendor_update on orders;
create policy orders_vendor_update on orders for update to app_runtime
  using (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or (app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists order_history_insert on order_status_history;
create policy order_history_insert on order_status_history for insert to app_runtime
  with check (exists (select 1 from orders o where o.id = order_id and (app_is_admin() or (app_owns_store(o.store_id) and store_has_vendor_access(o.store_id)))));

drop policy if exists order_tracking_insert on order_tracking;
create policy order_tracking_insert on order_tracking for insert to app_runtime
  with check (exists (select 1 from orders o where o.id = order_id and (app_is_admin() or (app_owns_store(o.store_id) and store_has_vendor_access(o.store_id)))));

drop policy if exists refunds_vendor_request on refunds;
create policy refunds_vendor_request on refunds for insert to app_runtime
  with check (app_is_admin() or (store_id is not null and app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists reviews_update on reviews;
create policy reviews_update on reviews for update to app_runtime
  using (app_is_admin() or customer_id = app_current_user_id() or (app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or customer_id = app_current_user_id() or (app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists messages_vendor_insert on customer_messages;
create policy messages_vendor_insert on customer_messages for insert to app_runtime
  with check (store_id is not null and app_owns_store(store_id) and store_has_vendor_access(store_id));

drop policy if exists messages_update on customer_messages;
create policy messages_update on customer_messages for update to app_runtime
  using (app_is_admin() or (store_id is not null and app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or (store_id is not null and app_owns_store(store_id) and store_has_vendor_access(store_id)));

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
        or (audience = 'customers' and app_current_role() = 'anon')
      ))
      or (scope = 'store' and audience in ('customers','everyone') and (store_is_live(store_id) or app_owns_store(store_id) or app_is_admin()))
    )
  );

drop policy if exists announcements_insert on announcements;
create policy announcements_insert on announcements for insert to app_runtime
  with check (app_is_admin() or (scope = 'store' and app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists announcements_update on announcements;
create policy announcements_update on announcements for update to app_runtime
  using (app_is_admin() or (scope = 'store' and app_owns_store(store_id) and store_has_vendor_access(store_id)))
  with check (app_is_admin() or (scope = 'store' and app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists announcements_delete on announcements;
create policy announcements_delete on announcements for delete to app_runtime
  using (app_is_admin() or (scope = 'store' and app_owns_store(store_id) and store_has_vendor_access(store_id)));

drop policy if exists announcement_products_write on announcement_products;
create policy announcement_products_write on announcement_products for all to app_runtime
  using (
    exists (
      select 1 from announcements a
      where a.id = announcement_id and (app_is_admin() or (app_owns_store(a.store_id) and store_has_vendor_access(a.store_id)))
    )
  )
  with check (
    exists (
      select 1 from announcements a
      where a.id = announcement_id and (app_is_admin() or (app_owns_store(a.store_id) and store_has_vendor_access(a.store_id)))
    )
  );

commit;
