# Ibom Vendors Hub

A multi-vendor commerce SaaS for Akwa Ibom businesses: every vendor gets its own
subdomain storefront (`businessname.ibomvendorshub.com`), its own catalogue,
workflows and subscription, while customers shop across one marketplace and track
every order from checkout to delivery.

Built with **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4** on
**PostgreSQL (Supabase-compatible)** with strict row-level security. Payments run
through **Paystack** (or the built-in sandbox gateway when no keys are set), email
through **Resend**, hosting on **Vercel**.

---

## What is in the product

| Area | Highlights |
| --- | --- |
| Marketplace | Home, browse/filter search, store directory, tracked orders, contact, legal pages |
| Storefronts | Per-vendor subdomain (or `/s/<slug>` fallback), cover/logo, featured products, category sections, reviews, contact form, cart drawer |
| Category-aware catalogues | Feature flags per category drive product fields and workflows (variants, add-ons, prep time, appointments, quotations, production tracking, warranty, made-to-order, size guides, min order…) |
| Commerce | Cart → checkout → payment → order, server-verified payments, 5% platform commission, 14-day trial, subscription plans and renewals |
| Vendor dashboard | Overview, orders + fulfilment workflow, products & images, store categories, quotations, bookings, customers, reviews, messages, subscription/billing, store profile, account settings, notifications, CSV export |
| Customer account | Orders with live timeline and tracking, quotations (accept/decline), bookings (cancel), addresses, reviews, notifications, profile & security |
| Admin | Platform KPIs, vendor approvals/rejections/suspensions/restores/visibility, subscription grants & plan editor, payments + refunds, categories & feature flags (attributes + workflow JSON), subdomain change requests, audit log, message inbox, platform settings |
| Operations | Daily cron for subscription reminders/expiry, Paystack webhook with HMAC + amount verification, health endpoint, audit logging, in-app notifications + transactional email |

### Non-negotiables encoded in the system

- **Multi-tenant isolation** — every query runs as the `app_runtime` Postgres role with
  `app.user_id` / `app.user_email` / `app.user_role` set per transaction; RLS policies
  decide what each role sees. Service-role access lives only in trusted server code.
- **No data loss** — suspension, expiry and rejection never delete a vendor's account,
  products, images or order history; storefronts simply go offline.
- **Payments are verified server-side** — only `markPaymentSuccessful()` can mark a
  payment successful. The webhook validates the Paystack signature over the raw body
  and compares amounts before confirming; the callback re-verifies with the gateway.
- **Subdomains are controlled** — reserved names (`admin`, `dashboard`, `api`, `www`,
  `support`, `mail`) are blocked and vendors cannot change their address without an
  admin-approved request.
- **Category configuration over code** — admins toggle features, attributes and order
  workflows per category without a redeploy.

---

## Getting started

Requirements: Node 20+, npm.

```bash
npm install
cp .env.example .env.local          # then set AUTH_SECRET
npm run dev:db                      # terminal 1 — embedded PostgreSQL (PGlite) on :5544, auto-migrates
npm run db:seed                     # first run: demo data (add -- --reset to wipe and reseed)
npm run dev                         # terminal 2 — http://localhost:3000
```

`npm run dev:db` starts a real PostgreSQL wire-protocol server backed by PGlite, so the
app talks to it with `pg` exactly as it would to Supabase. Point `DATABASE_URL` at a
Supabase project instead (see `.env.example`) to run against managed Postgres.

### Demo accounts (after seeding)

These only work against a seeded local database. Set `DEMO_MODE=1` to render the hint on `/login`;
production never seeds vendors, so the hint stays hidden there.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@ibomvendorshub.com` | `Admin1234!` |
| Vendor | `grace@mamaput.test` (Mama Put Kitchen) | `Vendor1234!` |
| Vendor | `emeka@uyogadgetmart.test` (expired subscription) | `Vendor1234!` |
| Customer | `customer@ibomvendorshub.com` | `Customer1234!` |

Other seeded vendors: `ima@royalfashion.test`, `victor@victorshoes.test`,
`excel@excelelectronics.test`, `blessing@glowbeauty.test`, `daniel@brightfix.test`.

### Useful scripts

```bash
npm run typecheck     # tsc --noEmit
npm run test          # typecheck + database/RLS checks
npm run test:db       # RLS isolation, payment integrity, retention checks
npm run test:smoke    # HTTP smoke test (needs the app running)
npm run build         # production build
npm run db:migrate    # apply supabase/migrations/*.sql
npm run db:seed -- --reset
```

---

## Architecture

```
src/
  app/
    (site)/            marketplace, cart, checkout, tracking, legal
    (auth)/            login, register (vendor/customer), password, verify email
    s/[slug]/          subdomain storefront: home, products, product, book, quote
    account/           customer dashboard
    vendor/            vendor dashboard
    admin/             platform administration
    pay/[reference]/   payment page + callback
    actions/           server actions (auth, public, payments, vendor, account, admin)
    api/               webhooks/paystack, cron/subscriptions, health, upload
  components/          server-first UI + focused client forms
  lib/                 db, auth, validation, stores, storefront, orders, subscriptions,
                       payments (+ gateway), email, notifications, audit, storage, domains
  middleware.ts        subdomain → /s/<slug> rewrite, security headers, auth gates
supabase/migrations/   0001 schema · 0002 RLS · 0003 functions · 0004 seed reference
scripts/               dev-db, migrate, seed, test-db, test-smoke, image generator
```

**Data access pattern.** `withActor(actor, fn)` opens a transaction, switches to the
`app_runtime` role and applies the actor's identity as transaction-local settings, so
RLS evaluates against the real caller. `withPublic(fn)` is the anonymous actor;
`withSystem(fn)` is trusted code that bypasses RLS (used for platform jobs, never with
unvalidated user input).

**Local development note.** PGlite serves a single database session, so local mode
serialises transactions (`DB_SERIALIZE=true`, pool size 1) and lets trusted nested
queries reuse the open transaction with an explicit role switch. Against Supabase this
is inert: each request gets its own pooled connection.

---

## Configuration

All settings live in `.env.local` (see `.env.example`) and can be managed in the admin
UI once the app is running (`/admin/settings`): platform name/tagline, support details,
main domain, commission rate, trial/grace days, approval requirement, payment mode,
Paystack keys, sender address and maintenance flag.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_SSL` | Postgres/Supabase connection (pooler needs `DATABASE_SSL=true`) |
| `AUTH_SECRET` | HS256 key for session cookies (32+ chars) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN` | Public URL and subdomain root |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Live payments; leave empty for the sandbox gateway |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email (logged locally when absent) |
| `CRON_SECRET` | Bearer token required by `/api/cron/subscriptions` |
| `NEXT_PUBLIC_DEV_EMAIL_LINKS` | `true` shows verification/reset links in the UI during local work |

### Deploying to Vercel

The project builds with `npm run vercel-build`, which applies `supabase/migrations/*.sql`,
creates the first administrator when `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set, and then
runs `next build`. Every deploy is therefore self-migrating and idempotent.

1. Create a Postgres database (Supabase project) and note its **pooler** connection
   string: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`.
2. Import this repository in Vercel (framework: Next.js, no root directory) and set:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the pooler URL above |
   | `DATABASE_SSL` | `true` |
   | `AUTH_SECRET` | `openssl rand -hex 32` |
   | `CRON_SECRET` | `openssl rand -hex 24` |
   | `NEXT_PUBLIC_APP_URL` | `https://<project>.vercel.app` |
   | `NEXT_PUBLIC_ROOT_DOMAIN` | `<project>.vercel.app` |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first platform administrator |
   | `RESEND_API_KEY`, `EMAIL_FROM` | optional — without them email is logged, not sent |
   | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | optional — otherwise the sandbox gateway is used |

3. Deploy. The build migrates the database and boots the admin account; the daily cron
   in `vercel.json` (06:00 UTC) then keeps subscriptions healthy.
4. Add the domain(s) in Vercel. For true vendor subdomains, add a wildcard domain
   `*.yourdomain.com` and set `NEXT_PUBLIC_ROOT_DOMAIN` to `yourdomain.com`. On the
   shared `*.vercel.app` host, storefronts are reachable at `/s/<slug>` (the middleware
   still rewrites subdomains when a wildcard domain is attached).
5. Point the Paystack webhook at `https://<your-domain>/api/webhooks/paystack`.

---

## Order and subscription lifecycle

1. Customer adds to cart → `createCheckout()` validates stock, category features,
   delivery/pickup rules and re-computes prices server-side, creating one order per
   store plus a payment record.
2. Payment (Paystack redirect or sandbox) → server verification marks the payment and
   orders paid, commits stock and allocates commission.
3. Vendor accepts → prepares/produces → ready → dispatches → delivered → completed,
   with each step written to `order_status_history`, optionally customer-visible.
4. Cancellations/refunds are recorded in `refunds` and reflected in the order timeline.
5. Subscriptions: 14-day trial → reminder emails at 7/3/1 days → grace period →
   storefront offline (all data retained) until renewal.

---

## Testing

- `npm run test:db` — 17 automated checks: schema, RLS policies, cross-tenant reads and
  writes, public visibility of expired/unavailable items, payment integrity, reference
  formats, retention for suspended/expired stores.
- `npm run test:smoke` — renders every public route plus the expired-storefront offline
  screen, 404s, protected-route redirects, cron auth and webhook signature rejection.

---

© Ibom Vendors Hub — Every business. One address.
