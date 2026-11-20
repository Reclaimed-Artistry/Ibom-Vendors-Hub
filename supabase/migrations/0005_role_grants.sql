-- ============================================================================
-- 0005 — Make SET ROLE app_runtime reliable on managed Postgres
-- ----------------------------------------------------------------------------
-- `0002_rls.sql` grants app_runtime to the connecting role, but on managed
-- Postgres (Supabase) that first grant can be created by a different grantor
-- with the SET option disabled, in which case every request fails with
--   error: permission denied to set role "app_runtime"
-- even though `pg_has_role(..., 'member')` is true.
--
-- Re-granting the membership with explicit WITH SET TRUE / INHERIT TRUE
-- updates the option flags of the existing membership row (membership rows are
-- keyed by grantor, so this adds/updates the row for the current grantor).
-- ADMIN option is deliberately withheld: granting ADMIN back to the grantor of
-- the original membership raises 0LP01 ("ADMIN option cannot be granted back to
-- your own grantor").
-- ============================================================================

begin;

do $grants$
declare
  opts text;
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    return;
  end if;

  -- PostgreSQL 16 added WITH { ADMIN | INHERIT | SET } { OPTION | TRUE | FALSE }.
  opts := case
    when current_setting('server_version_num')::int >= 160000
      then ' with admin false, inherit true, set true'
    else ''
  end;

  -- The connecting role used by the application (pooler / direct connection).
  begin
    execute format('grant app_runtime to %I%s', current_user, opts);
  exception when insufficient_privilege then
    raise warning 'could not grant app_runtime to %: %', current_user, sqlerrm;
  end;

  -- The owning role on managed Postgres. Reserved roles (supabase_admin) are
  -- rejected by the platform, so failures here are intentionally non-fatal.
  if current_user <> 'postgres'
     and exists (select 1 from pg_roles where rolname = 'postgres') then
    begin
      execute format('grant app_runtime to postgres%s', opts);
    exception when insufficient_privilege or reserved_name then
      raise warning 'could not grant app_runtime to postgres: %', sqlerrm;
    end;
  end if;
end
$grants$;

commit;
