# Ibom Vendors Hub — Technical Documentation

> Multi-vendor e-commerce SaaS platform with per-vendor subdomain storefronts for Akwa Ibom, Nigeria businesses.
>
> **Site value proposition:** "Every business. One address."
> **Root domain:** ibomvendorshub.com
> **Storefront URLs:** `<slug>.ibomvendorshub.com` (or `/s/<slug>` on localhost/preview)

---

## 1. Architecture Overview

Ibom Vendors Hub is a Next.js 15 App Router application built on PostgreSQL (Supabase or embedded PGlite for local development). It follows a multi-tenant architecture where each vendor gets their own subdomain storefront, while the platform root serves as a marketplace for discovery.

### Core Design Principles

| Principle | Description |
|-----------|-------------|
| **RLS-enforced multi-tenancy** | PostgreSQL Row Level Security via `app_runtime` role and session-level `app.user_id`/`app.user_role` settings. Data access is enforced at the database layer, not simulated in application code. |
| **Two connection modes** | `withActor()` — non-privileged role, RLS applies. `withSystem()` — superuser/bypass, for trusted backend code only. |
| **No plain-text passwords** | All secrets (API keys, DB credentials, SMTP) via environment variables only. |
| **Sandbox-first payments** | Paystack is the primary gateway; a sandbox mode is used when no secret key is configured. No money moves in sandbox. |
| **Free store access** | Vendor stores are free to own and operate (no trial countdown or subscription payment required). |

### Directory Structure

```
ibom-vendors-hub/
├── supabase/migrations/          # Database migrations (0001–0036+)
├── scripts/                      # Dev DB, seed, migration, and test scripts
├── src/
│   ├── app/                      # Next.js App Router pages & API routes
│   │   ├── (site)/               # Public marketplace routes (home, browse, stores, etc.)
│   │   ├── (auth)/               # Auth routes (login, register, reset, verify)
│   │   ├── (login)/              # Login page
│   │   ├── account/              # Customer account (orders, profile, wallet, etc.)
│   │   ├── admin/                # Admin dashboard (vendors, customers, payments, etc.)
│   │   ├── agent/                # Loan agent dashboard
│   │   ├── api/                  # API routes (checkout, webhooks, upload, etc.)
│   │   ├── s/[slug]/             # Vendor storefront (subdomain or /s/slug path)
│   │   ├── vendor/               # Vendor dashboard
│   │   ├── error.tsx             # Global error boundary (5xx)
│   │   ├── s/[slug]/error.tsx    # Storefront error boundary
│   │   ├── layout.tsx            # Root layout
│   │   ├── not-found.tsx         # 404 page
│   │   ├── robots.ts             # Dynamic robots.txt per host
│   │   └── sitemap.ts            # Dynamic sitemap per host
│   ├── components/               # React components (UI, forms, cart, etc.)
│   ├── lib/                      # Core libraries (db, auth, payments, seo, etc.)
│   └── middleware.ts             # Edge middleware for subdomain routing & SEO headers
├── globals.css                   # Tailwind v4 base styles + component CSS
├── DOCUMENTATION.md              # This file
└── package.json
```

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 15.5.29 | App Router, SSR, edge middleware |
| Runtime | React | 19.3.1 | Component UI |
| Database | PostgreSQL (Supabase / PGlite) | — | Multi-tenant data with RLS |
| Styling | Tailwind CSS | 4.3.5 | Utility-first CSS |
| Auth | JWT (jose) + bcrypt | — | Session cookies, password hashing |
| Payments | Paystack API | — | Online payments (NGN) |
| Email | Nodemailer + Whogohost SMTP | — | Transactional emails |
| Validation | Zod | 4.6.7 | Schema validation |
| Icons | Lucide React | — | SVG icon set |
| Date | date-fns | — | Date formatting/manipulation |
| TypeScript | — | 5.9.3 | Type safety |

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server on port 3000 (0.0.0.0) |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with demo data |
| `npm run vercel-build` | Migrate + bootstrap admin + build (Vercel) |
| `npm run db:bootstrap-admin` | Bootstrap initial admin user |

---

## 3. Database Architecture

### Connection & Security Model

The database layer (`src/lib/db.ts`) uses `pg` with two execution contexts:

- **`withActor(actor, fn)`** — Sets `app_runtime` role with session-level config `app.user_id`, `app.user_email`, `app.user_role`. RLS policies restrict rows based on these settings. Used for all user-facing requests.
- **`withSystem(fn)`** — Bypasses RLS (superuser/owner). Used for authentication lookups, webhooks, cron jobs, seeding, admin operations.
- **`withPublic(fn)`** — Actor with `role: "anon"`, RLS still applies but no user context.

For PGlite local development (port 5544), transactions are serialised via a mutex because PGlite serves a single session behind its socket multiplexer.

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Platform users (customers, vendors, admins) |
| `stores` | Vendor storefronts (one per owner, with subdomain slug) |
| `store_categories` | Product/service categories with features, attributes, workflow JSONB |
| `store_category_assignments` | Many-to-many store ↔ category |
| `products` | Vendor listings (products and services) |
| `product_images`, `product_variants`, `product_addons` | Product media, options, extras |
| `orders`, `order_items` | Orders and line items |
| `order_status_history` | Audit trail of order status changes |
| `order_tracking` | Delivery tracking events |
| `payments` | Payment records (Paystack, manual, wallet, sandbox) |
| `refunds` | Refund requests and processing |
| `subscriptions`, `subscription_plans` | Vendor subscription plans |
| `vendor_balances` | Vendor payout balances (escrow) |
| `wallets`, `wallet_transactions` | Customer wallets |
| `reviews` | Product/store reviews (verified purchases only) |
| `customer_messages` | Vendor-customer messaging |
| `announcements` | Platform-wide banners |
| `email_logs` | Sent/queued/failed email records |
| `audit_log` | Admin/vendor activity audit trail |
| `page_visits` | Visitor analytics (with bot filtering) |
| `loan_applications` | MONEY STEWARD loan partner applications |
| `auth_tokens` | Email verification / password reset tokens |

### Migrations

36 migrations exist (`supabase/migrations/0001_schema.sql` through `0036_professional_service_categories.sql`). Key migrations:

| Migration | Description |
|-----------|-------------|
| `0001_schema.sql` | Base schema (users, stores, products, orders, payments) |
| `0002_rls.sql` | Row Level Security policies |
| `0004_seed.sql` | Seed data (categories, stores, products) |
| `0009_kyc_akwa_ibom_delivery_checkout.sql` | KYC, delivery LGA, checkout fields |
| `0014_nigerian_artisan_categories_and_bookings.sql` | Artisan categories + service booking profiles |
| `0023_property_inspections.sql` | Property inspection booking system |
| `0024_free_store_ownership.sql` | Free store access (no subscription required) |
| `0027_expand_marketplace_categories.sql` | Additional marketplace categories |
| `0033_abandoned_carts.sql` | Abandoned cart tracking |
| `0034_page_visits.sql` | Visitor analytics with RLS |
| `0036_professional_service_categories.sql` | Security Service, Private Tutor, Counseling & Guidance |

---

## 4. Core Features

### 4.1 Multi-Tenant Storefronts

Each vendor gets a subdomain: `<slug>.ibomvendorshub.com`. The edge middleware (`src/middleware.ts`) handles:

1. **Subdomain detection** — Parses the `Host` header to extract the vendor slug.
2. **URL rewriting** — Rewrites requests to `/s/<slug>/<path>` for path-based access (localhost/preview).
3. **Canonical redirects** — Legacy `/s/<slug>` paths 301-redirect to the subdomain.
4. **SEO headers** — Sets `X-Robots-Tag: noindex` on non-indexable paths (admin, vendor, account, auth, cart, checkout, etc.).
5. **Cache headers** — `Cache-Control: private, no-store` on all HTML/RSC routes.

```typescript
// Middleware flow:
// 1. Detect subdomain from Host header
// 2. If store host accesses platform route → 301 redirect to platform
// 3. If platform host accesses /s/slug → 301 redirect to subdomain
// 4. Otherwise rewrite request to /s/slug/path with x-store-slug header
```

### 4.2 Marketplace (Platform Root)

The platform root (`/`) serves as a discovery marketplace:

- **Home** (`/`) — Featured stores, products, platform stats
- **Browse** (`/browse`) — Searchable/filterable product listing with pagination
- **Stores** (`/stores`) — Vendor directory with category filtering
- **About** (`/about`) — Platform information
- **Contact** (`/contact`) — Contact form
- **Sell** (`/sell`) — Vendor onboarding landing page
- **Terms/Privacy** (`/terms`, `/privacy`) — Legal pages
- **Track** (`/track`) — Order tracking (public)

SEO: Sitemap and robots.txt are generated dynamically per host (`src/app/sitemap.ts`, `src/app/robots.ts`). Only canonical hosts are indexable; search query pages are `noindex, follow`.

### 4.3 Vendor Storefronts (`/s/[slug]` or subdomain)

Each vendor storefront is a fully independent mini-site:

- **Home** (`/s/[slug]`) — Store cover, logo, name, featured products, services, contact info, operating hours
- **Products** (`/s/[slug]/products`) — Catalogue with search, sorting, category filtering, pagination
- **Product detail** (`/s/[slug]/products/[productSlug]`) — Media gallery, price, description, reviews, Add to Cart / Book now / Request quotation
- **Booking** (`/s/[slug]/book/[productSlug]`) — Service booking form with category-tailored fields
- **Quotation** (`/s/[slug]/quote/[productSlug]`) — Request quotation flow

**SEO per storefront:**
- `generateMetadata` sets `index: live` (only live/approved stores are indexable)
- Offline stores return `{ robots: NO_INDEX }`
- Product pages set `index: live` only when store is live
- JSON-LD structured data for store and product

### 4.4 Category System & Features

Categories are defined in `store_categories` with JSONB `features`, `attributes`, and `workflow` fields:

```typescript
interface CategoryFeatures {
  inquiryOnly?: boolean;    // No purchase, enquire only
  propertyListings?: boolean; // Real estate
  catalogue?: boolean;      // Product catalogue
  cart?: boolean;           // Shopping cart enabled
  stock?: boolean;          # Inventory tracking
  variants?: boolean;       # Product variants
  addons?: boolean;         # Product add-ons
  prepTime?: boolean;       # Food prep time
  operatingHours?: boolean; # Store open/close hours
  delivery?: boolean;       # Delivery offered
  pickup?: boolean;         # Pickup offered
  appointments?: boolean;   # Appointment booking
  quotations?: boolean;     # Quote requests
  productionTracking?: boolean; # Made-to-order production tracking
  madeToOrder?: boolean;    # Made to order badge
  serviceBooking?: boolean; # Service booking enabled
  warranty?: boolean;       # Warranty info
  reviews?: boolean;        # Customer reviews
  sizeGuide?: boolean;      # Size guide
  minOrder?: boolean;       # Minimum order value
}
```

**storeFeatures()** unions features across all of a store's business categories. **directBooking()** determines whether a product shows "Book now" vs "Add to cart" vs "View & enquire".

### 4.5 Service Booking System

Service booking profiles are defined in `src/lib/artisan-bookings.ts`. Each category slug has a `CategoryBookingProfile` with:

- **Requirements** — Customer-facing prerequisites
- **Visit types** — Available appointment types
- **Extra fields** — Category-specific form fields (select/text)
- **Time slots** — Available appointment times
- **Confirm label** — Checkbox confirmation text

**Implemented categories:**
- `artisans-carpentry-woodwork` — Woodworkers, furniture makers
- `artisans-electrical-solar` — Electricians, solar installers
- `artisans-plumbing-water` — Plumbers, borehole techs
- `artisans-pop-painting-finishing` — Painters, tilers, POP installers
- `artisans-masonry-welding-construction` — Masons, welders, roofers
- `artisans-ac-auto-mechanical` — AC, auto mechanics
- `artisans-home-domestic-trades` — Cleaning, laundry, locksmiths
- `beauty-personal-care` — Hair, makeup, spa
- `security-service` — Static guarding, mobile patrol, event security
- `private-tutor` — School subjects, exam prep, language
- `counseling-guidance` — Career, marriage, mental health, academic

The booking form (`src/components/storefront-forms.tsx`) reads the profile via `getCategoryBookingProfile(categorySlug)` and renders tailored requirements, visit types, extra fields, and time slots.

### 4.6 Checkout & Orders

**Checkout flow** (`src/lib/orders.ts`):

1. Customer signs in (required for checkout)
2. `createCheckout()` validates inventory, store status, delivery areas
3. Groups items by store (multi-vendor cart supported)
4. Calculates delivery fees based on LGA (local government area)
5. Creates orders with `status: 'placed'`, `payment_status: 'pending'`
6. Creates payment record (Paystack, manual bank transfer, wallet, or pay-on-delivery)
7. Redirects to Paystack hosted checkout or `/pay/[reference]` for sandbox/manual

**Order status workflow** (category-dependent):
```
placed → payment_confirmed → accepted → preparing/in_production →
production_completed → ready_for_pickup/dispatch → dispatched → delivered → completed
```

Vendors can accept/reject orders, update production progress, dispatch with tracking, and mark delivered (requires 6-digit Delivery PIN from customer). Customers can confirm delivery to release vendor payout.

**Fulfilment types:** delivery, pickup, service, booking.

### 4.7 Payments

**Providers:**
- **Paystack** — Live/test NGN payments via hosted checkout
- **Sandbox** — Simulated gateway for development (no money moves)
- **Manual** — Direct bank transfers (vendor approves individually)
- **Wallet** — Customer wallet balance

**Payment record lifecycle:** `pending` → `success`/`failed`/`refunded`

Idempotency: `markPaymentSuccessful()` uses `FOR UPDATE` row locking and checks `alreadyProcessed` to prevent double-crediting.

**Webhooks:** `src/app/api/webhooks/paystack/route.ts` verifies Paystack signatures and marks payments successful.

**Refunds:** Admin can process refunds via Paystack API or wallet credit. Manual bank transfers cannot be refunded from platform funds.

### 4.8 Subscriptions & Store Access

Store subscription model (`src/lib/subscriptions.ts`):

- **Plans** — `subscription_plans` table with price, duration, features, product/order limits
- **Trial** — Default 14-day trial for new stores
- **Expiry** — Expired stores are suspended (offline page shown)
- **Renewal** — Vendors can renew via `/vendor/subscription`
- **FREE_STORE_ACCESS** — Currently `true` (stores are free, no payment required)

**Store statuses:** `pending` → `active` / `rejected` → `suspended` / `expired`

48-hour verification review for new stores (KYC: NIN, Proof of Residence, CAC).

### 4.9 Vendor Dashboard (`/vendor`)

Vendor-facing tools:

| Page | Purpose |
|------|---------|
| `/vendor` | Overview with stats, recent orders |
| `/vendor/orders` | Order management with status updates |
| `/vendor/orders/[id]` | Individual order detail |
| `/vendor/products` | Product catalogue management |
| `/vendor/products/new` | Create new product/service |
| `/vendor/products/[id]` | Edit product |
| `/vendor/categories` | Manage store product categories |
| `/vendor/bookings` | Service bookings |
| `/vendor/quotations` | Quote requests and responses |
| `/vendor/payouts` | Wallet balance and payout requests |
| `/vendor/payment-approvals` | Approve/reject manual bank transfers |
| `/vendor/customers` | Customer directory |
| `/vendor/reviews` | Customer reviews |
| `/vendor/messages` | Customer messages |
| `/vendor/notifications` | Notifications |
| `/vendor/announcements` | Store announcements |
| `/vendor/store` | Store profile (KYC documents) |
| `/vendor/settings` | Account settings |
| `/vendor/subscription` | Subscription management |
| `/vendor/onboarding` | Store setup wizard |

### 4.10 Admin Dashboard (`/admin`)

Admin-facing tools:

| Page | Purpose |
|------|---------|
| `/admin` | Overview with stats |
| `/admin/vendors` | Vendor management (approve/reject/suspend) |
| `/admin/customers` | Customer management |
| `/admin/orders` | All orders |
| `/admin/payments` | Payment monitoring, refunds |
| `/admin/subscriptions` | Subscription plans |
| `/admin/categories` | Category management |
| `/admin/announcements` | Platform announcements |
| `/admin/analytics` | Visitor analytics (page views, store views) |
| `/admin/audit` | Activity audit log |
| `/admin/emails` | Email log and retry |
| `/admin/abandoned-carts` | Cart recovery |
| `/admin/loans` | Loan application management |
| `/admin/loan-assessments` | Loan assessment workflow |
| `/admin/messages` | Platform messages |
| `/admin/notifications` | Admin notifications |
| `/admin/settings` | Platform settings |
| `/admin/subdomains` | Subdomain requests |

### 4.11 Customer Account (`/account`)

Customer-facing tools:

| Page | Purpose |
|------|---------|
| `/account` | Dashboard with recent orders |
| `/account/orders` | Order history |
| `/account/orders/[id]` | Order detail with tracking |
| `/account/orders/[id]/invoice` | Printable invoice |
| `/account/profile` | Profile management |
| `/account/addresses` | Delivery addresses |
| `/account/wallet` | Wallet balance and top-up |
| `/account/bookings` | Service bookings |
| `/account/quotations` | Quote requests |
| `/account/reviews` | Customer reviews |
| `/account/notifications` | Notifications |
| `/account/repay-loan` | Loan repayment |

### 4.12 Email System

Transactional emails via `src/lib/email.ts`:

- **Provider:** Whogohost SMTP (configured via `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`)
- **Fallback:** Emails are logged to `email_logs` table even without SMTP; visible in Admin → Emails
- **Deduplication:** `dedupe_key` prevents duplicate emails
- **Templates:** 40+ email templates (order receipts, payment confirmations, vendor welcome, store approved/declined, subscription expiring, etc.)
- **Retry:** Failed emails can be retried (max 3 attempts)

### 4.13 Analytics & Visitor Tracking

- **Page visits** (`src/app/api/visit/route.ts`) — POST endpoint with bot filtering
- **Visit beacon** (`src/components/visit-beacon.tsx`) — Client-side ping on mount/navigation
- **Store slug tracking** — Visits attributed to vendor subdomains via `documentElement.dataset.storeSlug`
- **Admin analytics** (`/admin/analytics`) — Total views, unique visitors, top stores, recent visits
- **Mobile scroll** — All tables wrapped in `overflow-x-auto` containers for horizontal scrolling

### 4.14 SEO

- **Dynamic sitemap** (`src/app/sitemap.ts`) — Per-host, includes live stores, products, category pages
- **Dynamic robots.txt** (`src/app/robots.txt`) — Per-host rules
- **Metadata** — `publicMetadata()` helper for Open Graph, Twitter cards, canonical URLs
- **Structured data** — JSON-LD for Organization, WebSite, Store, Product, BreadcrumbList
- **Noindex** — Admin, vendor, account, auth, cart, checkout, booking, quote pages
- **301 redirects** — Permanent redirects for canonical URL consolidation

---

## 5. How to Implement Features

### 5.1 Adding a New Store Category

1. **Create a migration** (e.g., `0037_new_category.sql`):

```sql
insert into store_categories (name, slug, description, icon, sort_order, features, attributes, workflow, is_active)
values (
  'New Category',
  'new-category',
  'Description here',
  '🛠️',
  30,
  '{"catalogue": true, "cart": true, "stock": true, "reviews": true}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  30,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  features = excluded.features,
  attributes = excluded.attributes,
  workflow = excluded.workflow,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
```

2. **Run migration:** `npm run db:migrate`
3. **The category automatically appears** in the browse/stores filter and store onboarding.

### 5.2 Adding a Service Booking Profile

Edit `src/lib/artisan-bookings.ts`:

```typescript
export const CATEGORY_BOOKING_PROFILES: Record<string, CategoryBookingProfile> = {
  'your-category-slug': {
    isArtisan: false,
    heading: "Book a [Service]",
    subtitle: "Instructions for the customer...",
    ctaLabel: "Book now",
    paymentNote: "Payment terms...",
    tradesCovered: ["Trade 1", "Trade 2"],
    requirementsTitle: "Booking Requirements",
    requirements: ["Requirement 1", "Requirement 2"],
    requiresSiteAddress: true,
    siteAddressLabel: "Address",
    siteAddressPlaceholder: "e.g. 123 Street, Uyo",
    visitTypes: ["Visit Type 1", "Visit Type 2"],
    extraFields: [
      {
        key: "field_key",
        label: "Field Label",
        type: "select",
        options: ["Option A", "Option B"],
        required: true,
      },
    ],
    notesLabel: "Notes",
    notesPlaceholder: "Additional details...",
    confirmLabel: "I confirm...",
    timeSlots: ["09:00", "10:00", "11:00"],
  },
};
```

The booking form automatically picks up the profile via `getCategoryBookingProfile(categorySlug)`.

### 5.3 Adding a New Email Template

1. Add a `case` in the `template()` function in `src/lib/email.ts`
2. Call `sendEmail()` with the template name from any server action or API route

```typescript
await sendEmail({
  to: customer.email,
  template: "your_template_name",
  data: { name: customer.fullName, orderReference: order.reference },
  dedupeKey: `template:${order.id}`,
});
```

### 5.4 Adding a New Admin Page

1. Create `src/app/admin/[page]/page.tsx`
2. Protect with `requireAdmin()` at the top
3. Add nav entry in `src/app/admin/layout.tsx`
4. Use `systemDb` for admin queries (bypasses RLS)

### 5.5 Adding a New Vendor Page

1. Create `src/app/vendor/[page]/page.tsx`
2. Protect with `requireActiveVendorContext()` 
3. Add nav entry in `src/app/vendor/layout.tsx`
4. Use `getVendorContext()` for store context

### 5.6 Adding a New API Route

1. Create `src/app/api/[route]/route.ts`
2. Export `GET`, `POST`, etc. handlers
3. Use `withActor()` or `withSystem()` for database access
4. Add to middleware config matcher if needed

### 5.7 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | JWT signing secret (min 16 chars) |
| `NEXT_PUBLIC_APP_URL` | Yes | Platform URL (e.g., https://ibomvendorshub.com) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Yes | Root domain (e.g., ibomvendorshub.com) |
| `SMTP_HOST` | No | SMTP server host |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_PORT` | No | SMTP port (default 465) |
| `SMTP_SECURE` | No | SMTP secure (default true for 465) |
| `PAYSTACK_SECRET_KEY` | No | Paystack secret key (sk_test_/sk_live_) |
| `PAYSTACK_PUBLIC_KEY` | No | Paystack public key (pk_test_/pk_live_) |
| `PAYSTACK_ENABLED` | No | Set "true" to enable live Paystack |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_SITE_VERIFICATION` | No | Google Search Console verification |
| `BING_SITE_VERIFICATION` | No | Bing Webmaster verification |
| `DATABASE_SSL` | No | Set "true" for SSL connections |
| `DB_SERIALIZE` | No | Set "true" for PGlite serialization |
| `NODE_ENV` | No | development/production |

---

## 6. Deployment

### Local Development

```bash
# Install dependencies
npm install

# Start embedded PostgreSQL (PGlite) on port 5544
npm run dev:db &

# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Start Next.js dev server
npm run dev
```

Visit http://localhost:3000

Storefronts are accessible at http://localhost:3000/s/<slug> (no wildcard DNS needed locally).

### Production (Vercel)

1. Connect repository to Vercel
2. Set all environment variables in Vercel dashboard
3. Build command: `npm run vercel-build` (runs migrations, bootstraps admin, then builds)
4. Configure wildcard DNS: `*.ibomvendorshub.com` → Vercel
5. Set `NEXT_PUBLIC_ROOT_DOMAIN=ibomvendorshub.com`

### Database Migrations

Migrations are run via `tsx scripts/migrate.ts`. Each migration should be idempotent where possible (use `on conflict (slug) do update`).

### Bootstrap Admin

```bash
npm run db:bootstrap-admin
```

Creates the initial super_admin user (prompts for email/password).

---

## 7. Testing

| Test Command | Description |
|--------------|-------------|
| `npm run typecheck` | TypeScript compilation check |
| `npm run test:smoke` | Smoke test core flows |
| `npm run test:db` | Database connectivity test |
| `npm run test:seo` | SEO metadata and robots test |
| `npm run test:categories` | Category migration and form test |
| `npm run test:service-bookings` | Service booking flow test |
| `npm run test:checkout-payments` | Checkout and payment test |
| `npm run test:login` | Login flow tests |
| `npm run test:media` | Media upload test |

---

## 8. Recent Changes & Fixes

### Search Console Indexing Fixes
- Added global error boundary (`src/app/error.tsx`) for 5xx errors
- Added storefront error boundary (`src/app/s/[slug]/error.tsx`)
- Changed middleware redirects from 308 to 301 for permanent redirect SEO
- Verified noindex is applied only to appropriate paths (admin, vendor, account, auth, cart, checkout, booking, quote, offline stores)

### Mobile Table Scrolling
- Changed `html`/`body` `overflow-x` from `clip` to `auto`
- Changed `.table-wrap` from `overflow-x-clip sm:overflow-x-auto` to `overflow-x-auto` (all breakpoints)
- Changed `.table` min-width from `sm:min-w-[640px]` to `min-w-[600px]`
- Changed dashboard layout root containers from `overflow-x-clip` to `overflow-x-auto` (vendor, admin, agent layouts)
- Wrapped unwrapped tables in `<div className="overflow-x-auto">` with `min-w-[600px]`

### Professional Service Categories
- Added Security Service, Private Tutor, Counseling & Guidance categories (migration 0036)
- Added tailored booking profiles in `src/lib/artisan-bookings.ts`
- Fixed type errors and typos in booking profiles

---

## 9. Key Design Decisions

1. **RLS at database level** — Security is enforced by PostgreSQL, not application code. This prevents bypass even if application code has bugs.
2. **Two connection modes** — Clear separation between user-scoped and system-scoped operations prevents accidental data exposure.
3. **Sandbox-first payments** — The platform works without Paystack keys; sandbox mode is clearly labelled and requires server-side verification.
4. **Free store access** — No subscription required for vendors to operate, lowering the barrier to entry.
5. **48-hour verification** — New stores undergo document review before going public, ensuring trust and safety.
6. **Dynamic SEO per host** — Sitemap, robots.txt, and metadata are generated dynamically based on the request host, supporting both subdomain and path-based access.
7. **No plain-text secrets** — All API keys and credentials are environment variables only; never committed to the repository.

---

## 10. Contributing

1. Create a feature branch from `main`
2. Make changes and run `npm run typecheck` and `npm run build`
3. Run relevant tests (`npm run test:smoke`, etc.)
4. Commit with descriptive message
5. Open pull request

**Never commit:**
- Plain-text passwords or API keys
- `.env` files
- `node_modules/`
- `.next/` build output

---

*Documentation generated for Ibom Vendors Hub v1.0.0*
