# Vendor product creation checks

Vendors add and edit their own listings from `/vendor/products/new` and
`/vendor/products/[id]`. Both the simple guided form and full editor use the
same authenticated `saveProductAction` and ownership-checked database
transaction. Marketplace categories and private catalogue sections remain
independent. Media must finish its verified upload before a listing is saved.

## Reliable save confirmation

Browser testing reproduced an intermittent streamed-completion failure: the
server committed a listing, but the hydrated editor could remain on
“Publishing…” instead of opening the saved listing. It occurred with both a
streamed redirect and a streamed action-state acknowledgement. This was a
client completion problem, not a missing product in the database.

- Hydrated editors now send small, string-only form details to
  `POST /api/vendor-products`. The endpoint uses the same `saveProductAction`
  validation/transaction but returns plain JSON with the actual committed
  listing URL, without a React router tree or action-state transition.
- The endpoint requires a matching dashboard Origin, vendor authentication,
  an owned store and active access; it rate-limits saves. Listing details are
  capped at 256 KiB including chunked bodies. Files never pass through it;
  the form sends only verified upload IDs/URLs after separate media uploads.
- `ProductSaveNavigation` performs a fresh same-origin GET of that listing.
  Only `/vendor/products/<UUID>?saved=1` is accepted; external or malformed
  destinations are rejected.
- A visible success message and real “Open saved product” link remain if browser
  navigation is blocked. The save button stays disabled while opening the saved
  product, and an immediate in-flight guard blocks repeated submissions while
  saving or redirecting. Requests time out after 60 seconds; network uncertainty
  is reported honestly with instructions to check Products, never automatically
  retried or presented as a confirmed save.
- Plain HTML/older clients do not send the opt-in and retain the original native
  303 redirect. Validation failures still return honest errors without claiming
  success or navigating. Product permissions, media verification, transaction
  boundaries and store access rules are unchanged.
- A pending-review store can prepare listings; public visibility still requires
  the store's normal approval/publication conditions. Suspended/rejected stores
  and cross-store edits remain blocked.

## Repeatable checks

With a production build running against a **local test database** and local
media storage:

```bash
npm run test:vendor-products
```

This runs:

1. React/DOM checks for confirmed-success navigation, same-origin saved-product
   URLs, one-time navigation, pending/duplicate/media guards, retained field
   errors and inputs, honest network failures and fallback/native links.
2. Actual HTTP/JSON product create/edit requests, category/section persistence,
   stock, variants, failed-save rollback, authentication/origin/access/body-size
   checks, cross-store rejection and JSON confirmation versus legacy 303 redirects.
3. Actual image/GIF/video/audio upload and attachment, content/type/size/ownership
   checks, 100 MiB boundary, the 10-file combined cap, and rendered galleries.

The HTTP suites reject non-local server/database URLs. Use the local fixture
`AUTH_SECRET` described in [login checks](LOGIN.md), never that value in
production. Disable local SMTP credentials. Fixtures are removed in `finally`.

Chromium QA additionally exercises actual vendor password login, safe
continuation to Add product, guided mobile creation with PNG/MP4 uploads,
full-editor creation with GIF upload, editing price/stock/variants, both new
listings appearing in the vendor catalogue and anonymous storefront, and a
shopper selecting quantity/variant and retaining the item in their cart.
The JSON completion change passed eight consecutive complete runs (24 saves)
against a local production build, with normal browser origin/security checks
and dashboard refresh enabled. Each run asserts exactly two created listings
and two creation audit records, checks the actual persisted details and removes
its fixtures. This is evidence of the tested workflows, not a guarantee against
all network or hosting failures.

Production verification is read-only; no fabricated listings are added to real
vendor stores. Local fixture stores, products, uploads and audit records are
cleaned up afterward.
