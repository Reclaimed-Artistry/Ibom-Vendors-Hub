-- ============================================================================
-- Ibom Vendors Hub — Visitor analytics: store_slug column
-- ============================================================================
-- Migration 0035: idempotent, applied on every deploy via vercel-build
-- ============================================================================

-- Add store_slug to page_visits so storefront views (accessed via subdomain
-- where window.location.pathname is '/', not '/s/{slug}') are attributed to
-- the correct store. Backfilled from existing path data where possible.

alter table if exists page_visits
  add column if not exists store_slug text;

create index if not exists page_visits_store_slug_idx on page_visits(store_slug);

-- Backfill store_slug from existing /s/{slug} paths so historic data is
-- attributed correctly.
update page_visits
set store_slug = split_part(path, '/', 3)
where store_slug is null
  and path like '/s/%';

-- ============================================================================
-- Notes for the platform owner:
-- - The storefront layout sets document.documentElement.dataset.storeSlug so
--   the VisitBeacon can attribute visits to the correct store even when the
--   store is accessed via a subdomain (pathname is '/', not '/s/{slug}').
-- - Backfill populates store_slug for any pre-existing /s/{slug} visits.
-- ============================================================================
