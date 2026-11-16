-- ============================================================================
-- Ibom Vendors Hub — triggers, guards and business functions
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Slug helpers
-- ---------------------------------------------------------------------------
create or replace function slugify(p_text text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function is_reserved_subdomain(p_name text) returns boolean
language sql stable as $$
  select lower(p_name) = any (array[
      'www','admin','administrator','dashboard','api','app','support','mail','email','help',
      'blog','docs','status','store','stores','vendor','vendors','account','accounts','auth',
      'login','signup','signin','register','payments','pay','checkout','static','assets','cdn',
      'images','media','root','system','superadmin','marketplace','track','tracking','terms',
      'privacy','about','contact','faq','sitemap','robots','webhooks','cron','health','assets',
      'ibom','ibomvendorshub','test','demo','staging','dev','preview'
    ])
    or exists (select 1 from reserved_subdomains r where r.name = lower(p_name));
$$;

-- ---------------------------------------------------------------------------
-- Guards: protect columns vendors must never change directly
-- ---------------------------------------------------------------------------
create or replace function guard_user_columns() returns trigger
language plpgsql as $$
declare v_role text := app_current_role();
begin
  if v_role in ('vendor', 'customer', 'anon') then
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

drop trigger if exists users_guard_columns on users;
create trigger users_guard_columns before update on users
for each row execute function guard_user_columns();

create or replace function guard_store_columns() returns trigger
language plpgsql as $$
declare v_role text := app_current_role();
begin
  if v_role = 'vendor' then
    if new.status is distinct from old.status
       or new.manual_suspension is distinct from old.manual_suspension
       or new.is_featured is distinct from old.is_featured
       or new.slug is distinct from old.slug
       or new.access_until is distinct from old.access_until
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.rating_avg is distinct from old.rating_avg
       or new.rating_count is distinct from old.rating_count then
      raise exception 'Vendors cannot modify protected store fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_guard_columns on stores;
create trigger stores_guard_columns before update on stores
for each row execute function guard_store_columns();

create or replace function guard_review_columns() returns trigger
language plpgsql as $$
declare v_role text := app_current_role();
begin
  if v_role = 'vendor' then
    if new.rating is distinct from old.rating
       or new.comment is distinct from old.comment
       or new.status is distinct from old.status
       or new.customer_id is distinct from old.customer_id
       or new.store_id is distinct from old.store_id then
      raise exception 'Vendors may only publish a response to a review';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_guard_columns on reviews;
create trigger reviews_guard_columns before update on reviews
for each row execute function guard_review_columns();

-- ---------------------------------------------------------------------------
-- Automatic domain creation for every store
-- ---------------------------------------------------------------------------
create or replace function create_store_domain() returns trigger
language plpgsql as $$
begin
  insert into store_domains (store_id, subdomain, is_primary)
  values (new.id, new.slug, true)
  on conflict (subdomain) do nothing;
  return new;
end;
$$;

drop trigger if exists stores_create_domain on stores;
create trigger stores_create_domain after insert on stores
for each row execute function create_store_domain();

create or replace function rename_store_domain() returns trigger
language plpgsql as $$
begin
  if new.slug is distinct from old.slug then
    update store_domains set subdomain = new.slug where store_id = new.id and is_primary;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_rename_domain on stores;
create trigger stores_rename_domain after update of slug on stores
for each row execute function rename_store_domain();

-- ---------------------------------------------------------------------------
-- Every order status change is recorded (defence in depth alongside app logs)
-- ---------------------------------------------------------------------------
create or replace function log_order_status_change() returns trigger
language plpgsql as $$
declare v_role text := app_current_role();
begin
  if new.status is distinct from old.status then
    if not exists (
      select 1 from order_status_history h
      where h.order_id = new.id and h.to_status = new.status
        and h.created_at > now() - interval '2 seconds'
    ) then
      insert into order_status_history (order_id, from_status, to_status, actor_id, actor_role)
      values (new.id, old.status, new.status, app_current_user_id(),
              case when v_role = 'anon' then 'system' else v_role end);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status on orders;
create trigger orders_log_status after update of status on orders
for each row execute function log_order_status_change();

-- ---------------------------------------------------------------------------
-- Rating aggregates
-- ---------------------------------------------------------------------------
create or replace function refresh_review_ratings() returns trigger
language plpgsql as $$
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

drop trigger if exists reviews_refresh_ratings on reviews;
create trigger reviews_refresh_ratings after insert or update or delete on reviews
for each row execute function refresh_review_ratings();

-- ---------------------------------------------------------------------------
-- Subscription activation / renewal  (system-owned, NOT executable by the app role)
-- ---------------------------------------------------------------------------
create or replace function apply_subscription_payment(
  p_store_id     uuid,
  p_plan_id      uuid,
  p_payment_id   uuid default null,
  p_amount       numeric default null,
  p_method       text default 'gateway',
  p_verified_by  uuid default null,
  p_note         text default null
) returns subscription_payments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_plan       subscription_plans;
  v_sub        subscriptions;
  v_existing   subscription_payments;
  v_old_expiry timestamptz;
  v_new_expiry timestamptz;
  v_sub_id     uuid;
  v_row        subscription_payments;
  v_owner      uuid;
  v_suspended  boolean;
begin
  select * into v_plan from subscription_plans where id = p_plan_id;
  if not found then
    raise exception 'Subscription plan not found';
  end if;

  -- Idempotency: never extend twice for the same gateway payment
  if p_payment_id is not null then
    select * into v_existing from subscription_payments
     where payment_id = p_payment_id and status = 'success';
    if found then
      return v_existing;
    end if;
  end if;

  select * into v_sub from subscriptions
   where store_id = p_store_id and status in ('active', 'trialing')
   order by expires_at desc limit 1;
  v_old_expiry := v_sub.expires_at;

  v_new_expiry := greatest(coalesce(v_old_expiry, now()), now())
                  + make_interval(days => greatest(coalesce(v_plan.duration_days, 30), 1));

  if v_sub.id is not null and v_sub.plan_id = p_plan_id then
    update subscriptions
       set status = 'active', expires_at = v_new_expiry, reminder_stage = 0, cancelled_at = null
     where id = v_sub.id
     returning id into v_sub_id;
  else
    if v_sub.id is not null then
      update subscriptions set status = 'expired' where id = v_sub.id;
      insert into subscription_history (subscription_id, store_id, from_status, to_status,
                                        from_expires_at, to_expires_at, note)
      values (v_sub.id, p_store_id, v_sub.status, 'expired', v_sub.expires_at, v_sub.expires_at,
              'Superseded by ' || v_plan.name);
    end if;
    insert into subscriptions (store_id, plan_id, status, started_at, expires_at)
    values (p_store_id, p_plan_id, 'active', now(), v_new_expiry)
    returning id into v_sub_id;
  end if;

  -- Restore the store unless an administrator manually suspended it.
  select owner_id, manual_suspension into v_owner, v_suspended from stores where id = p_store_id;
  update stores
     set status = case when manual_suspension then 'suspended' else 'active' end,
         access_until = null,
         suspension_reason = case when manual_suspension then suspension_reason else null end,
         suspended_at = case when manual_suspension then suspended_at else null end,
         suspended_by = case when manual_suspension then suspended_by else null end
   where id = p_store_id;

  insert into subscription_payments (subscription_id, store_id, plan_id, payment_id, amount, currency,
                                     days_added, old_expires_at, new_expires_at, status,
                                     verification_method, verified_by, note)
  values (v_sub_id, p_store_id, p_plan_id, p_payment_id, coalesce(p_amount, v_plan.price), v_plan.currency,
          greatest(coalesce(v_plan.duration_days, 30), 1), v_old_expiry, v_new_expiry, 'success',
          p_method, p_verified_by, p_note)
  returning * into v_row;

  insert into subscription_history (subscription_id, store_id, from_status, to_status,
                                    from_expires_at, to_expires_at, note)
  values (v_sub_id, p_store_id, coalesce(v_sub.status, 'none'), 'active', v_old_expiry, v_new_expiry,
          coalesce(p_note, 'Subscription activated'));

  insert into activity_logs (actor_id, actor_role, store_id, action, entity_type, entity_id, description, meta)
  values (p_verified_by,
          case when p_method = 'admin_grant' then 'admin' else 'system' end,
          p_store_id, 'subscription.activated', 'subscription', v_sub_id::text,
          'Subscription activated / renewed',
          jsonb_build_object('plan', v_plan.slug, 'expires_at', v_new_expiry,
                             'days', v_plan.duration_days, 'method', p_method));

  insert into notifications (user_id, store_id, type, title, body, action_url, dedupe_key)
  select v_owner, p_store_id, 'subscription',
         'Subscription active',
         'Your ' || v_plan.name || ' subscription is active until ' || to_char(v_new_expiry, 'DD Mon YYYY') || '.',
         '/vendor/subscription',
         'sub-activated:' || v_sub_id::text || ':' || v_new_expiry::text;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Automatic expiry: idempotent, safe to run as often as the scheduler likes
-- ---------------------------------------------------------------------------
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
    values (r.id, r.store_id, r.status, 'expired', r.expires_at, r.expires_at, 'Automatic expiry');

    update stores s
       set status = 'expired', suspension_reason = 'Subscription expired'
     where s.id = r.store_id
       and s.manual_suspension = false
       and s.status = 'active'
       and not (s.access_until is not null and s.access_until > now())
       and not exists (
         select 1 from subscriptions o
          where o.store_id = s.id and o.status in ('active','trialing') and o.expires_at > now()
       );

    insert into notifications (user_id, store_id, type, title, body, action_url, dedupe_key)
    select s.owner_id, s.id, 'subscription_expired', 'Subscription expired',
           'Your subscription expired on ' || to_char(r.expires_at, 'DD Mon YYYY') ||
           '. Your storefront is offline until you renew.',
           '/vendor/subscription', 'sub-expired:' || r.id::text
      from stores s where s.id = r.store_id;

    insert into activity_logs (actor_role, store_id, action, entity_type, entity_id, description,
                               meta)
    select 'system', r.store_id, 'subscription.expired', 'subscription', r.id::text,
           'Subscription expired automatically', jsonb_build_object('expires_at', r.expires_at)
      from stores s where s.id = r.store_id;

    store_id := r.store_id;
    subscription_id := r.id;
    expires_at := r.expires_at;
    select s.name, s.owner_id into store_name, owner_id from stores s where s.id = r.store_id;
    return next;
  end loop;

  -- Administrator-granted access periods that have ended (no subscription)
  for r in
    update stores s
       set status = 'expired', suspension_reason = 'Access period ended'
     where s.status = 'active'
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

-- ---------------------------------------------------------------------------
-- Public order tracking (contact-verified, never exposes other customers)
-- ---------------------------------------------------------------------------
create or replace function lookup_order(p_reference text, p_contact text)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_order orders;
  v_store stores;
  v_contact text := lower(trim(coalesce(p_contact, '')));
  v_digits  text := regexp_replace(coalesce(p_contact, ''), '\D', '', 'g');
begin
  select * into v_order from orders where upper(reference) = upper(trim(coalesce(p_reference, ''))) limit 1;
  if not found then return null; end if;

  if not (
       lower(v_order.customer_email) = v_contact
       or (v_digits <> '' and regexp_replace(coalesce(v_order.customer_phone, ''), '\D', '', 'g') = v_digits)
     ) then
    return null;
  end if;

  select * into v_store from stores where id = v_order.store_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id, 'reference', v_order.reference, 'checkout_reference', v_order.checkout_reference,
      'status', v_order.status, 'payment_status', v_order.payment_status,
      'fulfilment_type', v_order.fulfilment_type, 'currency', v_order.currency,
      'subtotal', v_order.subtotal, 'delivery_fee', v_order.delivery_fee,
      'service_fee', v_order.service_fee, 'discount', v_order.discount, 'total', v_order.total,
      'customer_name', v_order.customer_name, 'customer_email', v_order.customer_email,
      'customer_phone', v_order.customer_phone, 'delivery_address', v_order.delivery_address,
      'delivery_notes', v_order.delivery_notes, 'scheduled_for', v_order.scheduled_for,
      'estimated_completion_date', v_order.estimated_completion_date,
      'estimated_dispatch_date', v_order.estimated_dispatch_date,
      'estimated_delivery_date', v_order.estimated_delivery_date,
      'production_progress', v_order.production_progress,
      'tracking_number', v_order.tracking_number, 'tracking_carrier', v_order.tracking_carrier,
      'created_at', v_order.created_at, 'accepted_at', v_order.accepted_at,
      'dispatched_at', v_order.dispatched_at, 'delivered_at', v_order.delivered_at,
      'completed_at', v_order.completed_at, 'cancelled_at', v_order.cancelled_at,
      'cancellation_reason', v_order.cancellation_reason, 'customer_notes', v_order.customer_notes
    ),
    'store', jsonb_build_object(
      'name', v_store.name, 'slug', v_store.slug, 'logo_url', v_store.logo_url,
      'phone', v_store.phone, 'email', v_store.email, 'city', v_store.city, 'state', v_store.state
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name, 'variant_name', i.variant_name, 'unit_price', i.unit_price,
        'quantity', i.quantity, 'line_total', i.line_total, 'attributes', i.attributes,
        'addons', i.addons, 'measurements', i.measurements, 'kind', i.kind
      ) order by i.created_at)
      from order_items i where i.order_id = v_order.id), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', h.to_status, 'previous', h.from_status, 'note', h.note,
        'created_at', h.created_at, 'actor_role', h.actor_role
      ) order by h.created_at)
      from order_status_history h
      where h.order_id = v_order.id and h.customer_visible), '[]'::jsonb),
    'tracking', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', t.status, 'message', t.message, 'location', t.location,
        'carrier', t.carrier, 'occurred_at', t.occurred_at
      ) order by t.occurred_at)
      from order_tracking t where t.order_id = v_order.id), '[]'::jsonb),
    'payment', (
      select jsonb_build_object('status', p.status, 'amount', p.amount, 'currency', p.currency,
                                'reference', p.reference, 'paid_at', p.paid_at, 'channel', p.channel)
      from payments p
      where p.order_id = v_order.id or p.checkout_reference = v_order.checkout_reference
      order by p.created_at desc limit 1)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down privileged functions: the application role must never be able to
-- grant itself a subscription or force expiry processing.
-- ---------------------------------------------------------------------------
revoke all on function apply_subscription_payment(uuid, uuid, uuid, numeric, text, uuid, text) from public;
revoke all on function apply_subscription_payment(uuid, uuid, uuid, numeric, text, uuid, text) from app_runtime;
revoke all on function process_subscription_expiry() from public;
revoke all on function process_subscription_expiry() from app_runtime;

grant execute on function lookup_order(text, text) to app_runtime;
grant execute on function app_owned_store_ids() to app_runtime;
grant execute on function app_owns_store(uuid) to app_runtime;
grant execute on function store_is_live(uuid) to app_runtime;
grant execute on function slugify(text) to app_runtime;
grant execute on function is_reserved_subdomain(text) to app_runtime;

commit;
