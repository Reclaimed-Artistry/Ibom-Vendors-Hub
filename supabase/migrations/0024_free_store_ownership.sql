-- Owner-requested pause. Billing history is preserved; resumption requires an
-- explicit policy change and a new migration, never a date-based restart.
begin;
create or replace function store_has_vendor_access(p_store uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from stores s where s.id = p_store
    and not s.manual_suspension and s.status in ('active','pending'));
$$;
create or replace function store_is_live(p_store uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from stores s where s.id = p_store
    and s.status = 'active' and not s.manual_suspension and s.visibility = 'public');
$$;
-- Keep the old implementation for an explicitly planned future resumption.
alter function process_subscription_expiry() rename to process_subscription_expiry_before_free_stores;
create function process_subscription_expiry()
returns table (store_id uuid, subscription_id uuid, store_name text, owner_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return;
end;
$$;
revoke all on function process_subscription_expiry() from public, app_runtime;
update stores set status = case when approved_at is not null then 'active' else 'pending' end,
  suspension_reason = null, suspended_at = null
where status = 'expired' and not manual_suspension;
update announcements set is_active = false
where scope = 'platform' and (title || ' ' || message) ~* '(trial|subscription|renewal)';
insert into announcements (scope, audience, kind, title, message, link_url, cta_label, priority)
values ('platform','everyone','success','Your store is absolutely free',
  'Registering and owning a store on Ibomvendorshub is absolutely free. No trial countdown or subscription payment is required.',
  '/register','Create your free store',100);
insert into notifications (user_id,store_id,type,title,body,action_url,dedupe_key)
select owner_id,id,'announcement','Your store is absolutely free',
 'Registering and owning a store on Ibomvendorshub is absolutely free. Trial countdowns and subscription requirements are paused. Store approval and safety rules still apply.',
 '/vendor','free-store-ownership:' || id::text from stores;
commit;
