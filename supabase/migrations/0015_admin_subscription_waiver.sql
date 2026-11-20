-- 0015_admin_subscription_waiver.sql
-- Lets an administrator waive a vendor's subscription for any whole number of
-- calendar months from 1 through 12, at zero cost. The waiver extends the later
-- of now() or the current expiry (so remaining paid time is never lost),
-- restores an expired storefront, and writes payment, history, activity and
-- in-app notification records for a complete audit trail.

create or replace function admin_waive_subscription(
  p_store_id   uuid,
  p_months     integer,
  p_plan_id    uuid default null,
  p_admin_id   uuid default null,
  p_note       text default null
) returns subscription_payments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_plan       subscription_plans;
  v_sub        subscriptions;
  v_old_expiry timestamptz;
  v_base       timestamptz;
  v_new_expiry timestamptz;
  v_days_added integer;
  v_sub_id     uuid;
  v_row        subscription_payments;
  v_owner      uuid;
  v_label      text;
  v_full_note  text;
begin
  if p_months is null or p_months < 1 or p_months > 12 then
    raise exception 'Waiver duration must be between 1 and 12 months';
  end if;

  if p_admin_id is not null and not exists (
    select 1 from users
     where id = p_admin_id and role in ('super_admin', 'admin')
  ) then
    raise exception 'Waiver actor must be an administrator';
  end if;

  select * into v_sub from subscriptions
   where store_id = p_store_id and status in ('active', 'trialing')
   order by expires_at desc limit 1;

  -- Explicit plan -> current paid plan -> lowest-price paid plan -> any active plan
  if p_plan_id is not null then
    select * into v_plan from subscription_plans where id = p_plan_id;
    if v_plan.id is null then
      raise exception 'Selected subscription plan was not found';
    end if;
  elsif v_sub.plan_id is not null then
    select * into v_plan from subscription_plans where id = v_sub.plan_id and price > 0;
  end if;

  if v_plan.id is null then
    select * into v_plan from subscription_plans
     where is_active = true and price > 0
     order by price asc limit 1;
  end if;

  if v_plan.id is null then
    select * into v_plan from subscription_plans
     where is_active = true
     order by duration_days desc limit 1;
  end if;

  if v_plan.id is null then
    raise exception 'No subscription plan found to apply waiver';
  end if;

  v_old_expiry := v_sub.expires_at;
  v_base := greatest(coalesce(v_old_expiry, now()), now());
  v_new_expiry := v_base + make_interval(months => p_months);
  v_days_added := greatest(round(extract(epoch from (v_new_expiry - v_base)) / 86400.0)::integer, 1);
  v_label := p_months::text || ' month' || case when p_months = 1 then '' else 's' end;
  v_full_note := 'Subscription waived for ' || v_label ||
                 case when coalesce(btrim(p_note), '') <> '' then ' — ' || btrim(p_note) else '' end;

  if v_sub.id is not null and v_sub.plan_id = v_plan.id then
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
              'Superseded by ' || v_label || ' admin waiver (' || v_plan.name || ')');
    end if;
    insert into subscriptions (store_id, plan_id, status, started_at, expires_at)
    values (p_store_id, v_plan.id, 'active', now(), v_new_expiry)
    returning id into v_sub_id;
  end if;

  -- Restore stores that expired for non-payment, but keep manual/policy
  -- suspensions and not-yet-approved applications in their existing state.
  select owner_id into v_owner from stores where id = p_store_id;
  if not found then
    raise exception 'Store not found';
  end if;

  update stores
     set status = case
                    when manual_suspension then 'suspended'
                    when status in ('active', 'suspended', 'expired') then 'active'
                    else status
                  end,
         access_until = null,
         suspension_reason = case when manual_suspension then suspension_reason else null end,
         suspended_at = case when manual_suspension then suspended_at else null end,
         suspended_by = case when manual_suspension then suspended_by else null end
   where id = p_store_id;

  insert into subscription_payments (subscription_id, store_id, plan_id, payment_id, amount, currency,
                                     days_added, old_expires_at, new_expires_at, status,
                                     verification_method, verified_by, note)
  values (v_sub_id, p_store_id, v_plan.id, null, 0, v_plan.currency,
          v_days_added, v_old_expiry, v_new_expiry, 'success',
          'admin_grant', p_admin_id, v_full_note)
  returning * into v_row;

  insert into subscription_history (subscription_id, store_id, from_status, to_status,
                                    from_expires_at, to_expires_at, note)
  values (v_sub_id, p_store_id, coalesce(v_sub.status, 'none'), 'active', v_old_expiry, v_new_expiry,
          v_full_note);

  insert into activity_logs (actor_id, actor_role, store_id, action, entity_type, entity_id, description, meta)
  values (p_admin_id, 'admin', p_store_id, 'subscription.waived', 'subscription', v_sub_id::text,
          v_full_note,
          jsonb_build_object(
            'months_waived', p_months,
            'days_added', v_days_added,
            'plan', v_plan.slug,
            'old_expires_at', v_old_expiry,
            'expires_at', v_new_expiry,
            'note', btrim(p_note)
          ));

  insert into notifications (user_id, store_id, type, title, body, action_url, dedupe_key)
  select v_owner, p_store_id, 'subscription',
         'Subscription waived (' || v_label || ')',
         'An administrator waived your ' || v_plan.name || ' subscription for ' || v_label || '. Your storefront is covered until ' || to_char(v_new_expiry, 'DD Mon YYYY') || '.',
         '/vendor/subscription',
         'sub-waived:' || v_row.id::text;

  return v_row;
end;
$$;

-- Privileged function: only trusted server/database connections may execute it.
-- Supabase grants EXECUTE to anon/authenticated/service_role via default
-- privileges, so revoke the browser-facing roles explicitly where they exist.
revoke all on function admin_waive_subscription(uuid, integer, uuid, uuid, text) from public, app_runtime;
do $$
declare
  v_role text;
  v_fn   text := 'admin_waive_subscription(uuid, integer, uuid, uuid, text)';
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format('revoke all on function %s from %I', v_fn, v_role);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute format('grant execute on function %s to service_role', v_fn);
  end if;
end $$;
