-- ============================================================================
-- Ibom Vendors Hub — Visitor analytics
-- ============================================================================
-- Migration 0034: idempotent, applied on every deploy via vercel-build
-- ============================================================================

-- Page visits recorded by the client-side visit beacon (see
-- src/components/visit-beacon.tsx). Power the Visitor analytics panel at
-- /admin/analytics. Known bots are never recorded.

create table if not exists page_visits (
  id         uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id    uuid references users(id) on delete set null,
  path       text not null,
  referrer   text,
  user_agent text,
  ip         text,
  created_at timestamptz not null default now()
);

create index if not exists page_visits_created_idx on page_visits(created_at);
create index if not exists page_visits_path_idx on page_visits(path);
create index if not exists page_visits_session_idx on page_visits(session_id);

alter table if exists page_visits enable row level security;

create policy page_visits_admin on page_visits
  for select to authenticated
  using (
    exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin'))
  );

-- ============================================================================
-- Notes for the platform owner:
-- - Visits are recorded client-side (sendBeacon/fire-and-forget POST to
--   /api/visit) so page loads are never delayed by tracking.
-- - Visits from bots/crawlers and requests without a valid path are dropped.
-- - The analytics panel is available to admin and super_admin roles.
-- ============================================================================
