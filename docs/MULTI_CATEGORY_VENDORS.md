# Multi-category vendors

## Vendor experience

- Registration has a **primary business category** and optional additional-category checkboxes. Store registration and ownership remain free, without a trial.
- Existing vendors manage these under **Store profile → Business categories**.
- Both product editors have a **Marketplace category for this listing** selector. It includes the store's existing business categories and other active marketplace categories. Saving a listing in a new category also adds that business category to the store, atomically.
- Each listing has one marketplace category. Its fields, guide, cart/quotation/booking/inspection rules and marketplace placement follow that category—not every category offered by the store.
- A store appears once in every selected business category; its products appear only in their own categories.
- **Catalogue sections** (e.g. Dresses, Gifts) remain separate and vendor-owned. The Categories dashboard now makes this distinction explicit.
- Changing the primary category does not move existing listings. A category cannot be removed while any listing, including an unavailable listing, still uses it. Move or delete those listings first.
- Hiding a platform category prevents new category selections/listings, but does not erase category rules or prevent maintaining an existing listing in it.

## Data and compatibility

Migration `0030_multi_category_stores.sql` adds:

- `store_category_assignments(store_id, category_id)` with a unique composite key, ownership/public RLS, and reverse lookup index.
- `products.marketplace_category_id`, independent from the existing `products.category_id` FK to private `product_categories`.
- `order_items.marketplace_category_id` as a purchase-time category snapshot, so later product recategorisation/deletion does not change the order's workflow.

Existing stores receive their primary category as an assignment. Existing products/order items receive the category they previously inherited. Uncategorised data stays uncategorised. Images, variants, catalogue sections, prices, attributes and orders are not deleted or repurposed.

Legacy product inserts default to the store's primary category. Legacy product edit actions without the new input retain the listing's current category. Primary-category and listing-category membership constraints are deferred to allow atomic updates and store deletion. Database triggers also enforce active new selections and catalogue-section ownership.

Public category filtering/counts, store summaries, category sitemaps, product structured data, booking profiles, checkout guards, inspection scheduling and vendor order workflows use the new model. Mixed orders combine stages for the ordered items' categories, rather than inheriting an unrelated store primary category. Delivery verification/payment safeguards are unchanged.

## Checks

With the local database running and migrations applied:

```sh
npm run test:multi-categories
npm run typecheck
npm run lint
npm run test:db
npm run test:seo
npm run build
```

The multi-category test suite rebuilds an isolated in-memory pre-feature schema to test migration/backfill; tests real registration, discovery, counts, category ownership/RLS, mixed-store checkout/inspection behavior and order snapshots using rollback-only local fixtures; and exercises both editors and registration caution behavior in a DOM environment.

For actual Next.js production-server form submissions, start a **local** production server with a local test-only authentication secret:

```sh
AUTH_SECRET=local-category-preview-auth-secret-only \
NEXT_PUBLIC_APP_URL=https://www.ibomvendorshub.com \
NEXT_PUBLIC_ROOT_DOMAIN=ibomvendorshub.com \
npx next start -H 0.0.0.0 -p 3000

# In another shell:
npm run test:multi-categories:http
SEO_TEST_BASE_URL=http://127.0.0.1:3000 npm run test:seo:http
```

The HTTP test refuses a remote app/database, creates isolated local test users/stores, submits actual product/settings/booking server actions, checks storefront/admin output and cleans up in `finally`. `CATEGORY_TEST_BASE_URL` changes the local port; `CATEGORY_TEST_AUTH_SECRET` must match the local server's secret. **Never configure the example test secret in a deployed environment.** No production fixtures, credentials, email delivery, DNS or payment-provider changes are needed for these tests.
