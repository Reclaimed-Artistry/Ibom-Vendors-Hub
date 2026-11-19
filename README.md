# Ibom Vendors Hub

A multi-vendor commerce SaaS for Akwa Ibom businesses: every vendor gets its own
subdomain storefront (`businessname.ibomvendorshub.com`), its own catalogue,
workflows and subscription, while customers shop across one marketplace and track
every order from checkout to delivery.

Built with **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4** on
**PostgreSQL (Supabase-compatible)** with strict row-level security. Payments run
through **Paystack** (or the built-in sandbox gateway when no keys are set), email
through **your mail host's SMTP** (Whogohost/Go54 only),
hosting on **Vercel**.

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
| Flash announcements | Right-to-left ticker under the header on the marketplace, every storefront and the vendor workspace. Admins publish platform notices to vendors, customers or both; vendors flash their own sale to their shoppers and pick up to 12 products to feature. Pause, resume, delete, scheduled end dates, dismissible per reader, motion-safe |
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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Transactional email via Whogohost SMTP only; missing credentials disable delivery |
| Sender | `Ibom Vendors Hub <noreply@ibomvendorshub.com>` |
| `CRON_SECRET` | Bearer token required by `/api/cron/subscriptions` |
| `NEXT_PUBLIC_DEV_EMAIL_LINKS` | `true` shows verification/reset links in the UI during local work |

### Live deployment

The application is deployed at **https://www.ibomvendorshub.com** (Vercel project
`ibom-vendors-hub`, Supabase project `zjoktecqfdjprjwiwdgj`, Frankfurt pooler). The
production database carries reference data only — 7 categories, subscription plans and
the reserved-subdomain list — so the marketplace starts empty and the first vendor to
register claims the first storefront.

- Health: `https://www.ibomvendorshub.com/api/health` → `{"status":"ok","database":true}`
- Admin: the account named by `ADMIN_EMAIL` is created during the first build by
  `scripts/bootstrap-admin.ts`; change its password from **Account → Profile** after
  the first sign-in.
- Storefronts: `https://www.ibomvendorshub.com/s/<slug>` (wildcard subdomains resolve
  off `ibomvendorshub.com`).
- Automatic git deployments are **off** on that project; a push does not redeploy.
  Turn them on under *Vercel → Project → Settings → Git → Ignored Build Step /
  Production branch*, or trigger a deployment from a new commit.
- Email delivers through **your mail host's SMTP** when `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`
  are set in the Vercel environment — create a mailbox (e.g. `noreply@ibomvendorshub.com`) in
  Whogohost/Go54, point the domain's MX and SPF records at the mail host, and set
  `EMAIL_FROM` to that mailbox. This is the recommended path and needs no third-party
  sender verification. No alternative email provider is used.
- Payments run on Paystack **test** keys (`pk_test_…` / `sk_test_…`, secret stored as a Vercel
  sensitive variable) with the sandbox switch turned off, so checkouts create real Paystack
  test transactions and are verified server-side. Switch the keys to live and re-check
  before taking real money.

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
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | required for Whogohost delivery — without them email is logged only |
   | Sender | Fixed to `noreply@ibomvendorshub.com` |
   | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | optional — otherwise the sandbox gateway is used |

3. Deploy. The build migrates the database and boots the admin account; the daily cron
   in `vercel.json` (06:00 UTC) then keeps subscriptions healthy.
4. Add the domain(s) in Vercel. For true vendor subdomains, add a wildcard domain
   `*.yourdomain.com` and set `NEXT_PUBLIC_ROOT_DOMAIN` to `yourdomain.com`. On the
   shared `*.vercel.app` host, storefronts are reachable at `/s/<slug>` (the middleware
   still rewrites subdomains when a wildcard domain is attached).
5. Point the Paystack webhook at `https://<your-domain>/api/webhooks/paystack`.

### Brand assets

The supplied logo (`assets/brand/logo-source.png`) is a transparent PNG lockup: shopping
bag with the Akwa Ibom silhouette, swoosh, "Ibom Vendors Hub" wordmark and the tagline
*One Hub. Every business. Endless opportunities.* `npm run brand:assets` regenerates every
derivative from it — it removes only fully transparent padding (an exact alpha bounding box)
and never crops the artwork:

| Output | Use |
| --- | --- |
| `public/brand/ibom-vendors-hub-logo.png` / `.webp` | site header, footer, auth panel, dashboards, storefront footer, email header |
| `public/brand/ibom-vendors-hub-logo-small.png` | compact surfaces |
| `public/brand/og-image.png` | Open Graph / Twitter card |
| `src/app/icon.png`, `src/app/apple-icon.png`, `public/brand/icon-512.png` | favicon and touch icons (full lockup letterboxed on white) |

`<Logo>` renders the whole lockup with `object-contain`, height-driven sizing and `w-auto`, so
it is never stretched or clipped; `invert` puts it on a white chip for dark surfaces because
the wordmark is dark green.

### Google sign-in

`/auth/google` runs a server-side authorization-code flow: it mints a CSRF `state` into an
HttpOnly cookie, exchanges the code at Google's token endpoint and verifies the returned ID
token against Google's JWKS (signature, issuer, audience, expiry) before anything is trusted.
An existing account is matched by verified email — vendors and admins included, so a vendor
can use Google to reach their dashboard — and a brand-new email creates a **customer**
account with `email_verified_at` set (vendors still register through `/register` because a
store needs business details). Suspended accounts are refused. The flow is only rendered when
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, so no dead button appears otherwise.

To enable it: Google Cloud Console → APIs & Services → Credentials → *Create credentials* →
*OAuth client ID* → *Web application*, then add `https://<your-domain>/auth/google/callback`
under **Authorised redirect URIs** (and `https://<your-domain>` under **Authorised JavaScript
origins**).

Save the matching `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in **Vercel → Project →
Settings → Environment Variables**, targeting Production, then redeploy. Mark the secret
sensitive; never use a `NEXT_PUBLIC_` prefix. Google credentials and enablement are not
managed through the admin dashboard or database. Both variables are required for the button
to appear; removing either and redeploying disables it. `GOOGLE_REDIRECT_URI` optionally
overrides the computed callback URL. For production, whitelist exactly
`https://www.ibomvendorshub.com/auth/google/callback` in Google Cloud.
`/api/health` reports `signIn.google` as `live` (configured, not an end-to-end OAuth test)
or `unconfigured`.

### Media storage

Listing editors accept photos/animated GIFs, MP4/WebM/MOV video and common audio formats,
up to 10 files per listing and 100 MB per uploaded file. Large files go **directly to a
store-scoped signed Supabase Storage URL**, with progress and server-side verification,
not through a Vercel function/server-action body. GIFs retain their original animation.
Store logos/covers and KYC documents keep their existing separate upload rules.

Storage uses `NEXT_PUBLIC_SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY` and
`SUPABASE_STORAGE_BUCKET` (default `storefronts`). The bucket must exist and be public for
reads. Migration 0031 configures its MIME allowlist and 100 MB per-object limit.
**The project's global limit must also allow 100 MB: Supabase Free caps a file at 50 MB,
so uploads above 50 MB require a suitable paid plan and Storage Settings change by the
owner. No billing upgrade is performed automatically.** A bucket change alone is not
proof of live 100 MB acceptance. See [vendor media setup, safety and tests](docs/VENDOR_MEDIA.md).

Without storage credentials, legacy image uploads use `public/uploads`; listing media
stream to ignored `.data/vendor-media` with local byte-range delivery. Both disk paths are
local development only. Serverless deployments refuse missing storage configuration
rather than returning URLs for files that will disappear.

### Known external setup

These are owner-side steps that no code change can complete:

| Item | Effect until done |
| --- | --- |
| Google OAuth client ID + secret (Admin → Platform settings) | the "Continue with Google" button stays hidden |
| Whogohost/Go54 mail hosting + MX/SPF records for `ibomvendorshub.com` (e.g. `mail.ibomvendorshub.com`, port 465) | transactional email fails or lands in spam (Admin → Emails shows the exact provider error) |
| Paystack live keys | checkout runs in test mode |
| A real domain on Vercel | storefront subdomains can't resolve; `/s/<slug>` works in the meantime |

### Payments

The gateway adapter (`src/lib/payments/gateway.ts`) talks to Paystack's REST API with the
**secret** key: it creates the transaction server-side, returns Paystack's hosted checkout
URL, and re-verifies amount + currency on the callback *and* on the signed webhook before a
payment can be marked successful. Without a secret key it falls back to the sandbox gateway,
which still records a real payment row and still requires server-side confirmation.

`gatewayStatus()` (in `src/lib/settings.ts`) reports which keys are present, whether they are
test or live, where each came from (platform settings override the environment) and every
mismatch worth fixing — public key without a secret, mixed test/live keys, keys configured
while the sandbox switch is still on. The same summary appears in Admin → Payments, Admin →
Settings and the `payments` block of `/api/health`.

*Test Paystack connection* on Admin → Payments runs `checkPaystackCredentials()`, which calls
Paystack's `/balance` endpoint with the configured secret key — a key can be well-formed and
still revoked, from another account or from the wrong mode, and that should never be discovered
by a customer at checkout. The result is written to the audit log, so a rejected key is
traceable. Register `https://<domain>/api/webhooks/paystack` under Settings → API Keys &
Webhooks in Paystack; the webhook is verified with the same secret key (`x-paystack-signature`).

### Transactional email

`src/lib/email.ts` renders every message through reusable HTML templates, writes it to
`email_logs` with a dedupe key (so one event can never be emailed twice) and delivers it
through the configured provider. **Admin → Emails** lists the log with per-message status,
attempt count and the provider's error text, and offers two controls: *Send test email*
(uses the real provider and from address) and *Retry failed messages* (the daily cron also
retries up to three times, so an outage self-heals once the provider recovers).

Recommended provider: **your mail host's SMTP** (Whogohost/Go54). Create a mailbox in
DirectAdmin — e.g. `noreply@ibomvendorshub.com` — and set `SMTP_HOST=mail.ibomvendorshub.com`,
`SMTP_PORT=587`, `SMTP_SECURE=false` (STARTTLS), `SMTP_USER=<full mailbox address>`, `SMTP_PASS=<password>`.
The domain must resolve to the mail host (MX record) and carry an SPF record naming it, or
messages may bounce or land in spam. Whogohost SMTP is the only provider; there is no fallback.
Without any provider the platform still renders and stores messages, marking them `skipped` —
no flow silently depends on email.

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

### House agents & realtors

Choose **House Agents & Realtors** during vendor registration. In **Products → Add property**,
upload property photos and enter the rent/sale price, location, price period, inspection fee
(0 for free), and other fees. Save, then open the listing editor’s **Inspection availability**
section to publish future date/time slots (WAT), duration and an exact meeting address:
agent’s office or another clearly specified location. Slots cannot overlap across the agency.

Customers open a property and select **Book inspection**, sign in and choose a published slot.
The slot is reserved pending agent confirmation; both parties see the meeting point and fee in
Bookings and receive notifications/email records. No online fee or property payment is taken.
Agents confirm, decline, complete or cancel in **Bookings**. A cancelled slot may be booked
again, or withdrawn in the property editor; booked slots cannot be silently changed or removed.
To reschedule, contact the customer, cancel the original booking, and agree on another slot.
Property purchases are blocked from the shopping checkout. Booking details snapshot the fee
and location, so subsequent listing edits do not change the customer’s existing request.
