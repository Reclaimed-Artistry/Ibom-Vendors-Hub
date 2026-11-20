# Search visibility

## Implemented

- Server-rendered titles, descriptions, canonical URLs, Open Graph and Twitter cards for public pages, category listings, live storefronts, catalogues and individual products/services.
- `https://www.ibomvendorshub.com/robots.txt` advertises the marketplace sitemap at `/sitemap.xml`.
- Each vendor host has its **own** `/robots.txt` and `/sitemap.xml`, e.g. `https://kemcycollections.ibomvendorshub.com/sitemap.xml`. A sitemap lists only its own host's canonical URLs, not cross-host or redirecting `/s/...` URLs.
- Sitemaps query current public data. Pending, rejected, suspended and unlisted stores and unpublished/unavailable listings are excluded. Empty marketplace filters are omitted. Sitemap failure is not silently converted into an empty success response.
- Metadata and HTTP `X-Robots-Tag` keep account, admin, vendor, sign-in, checkout, payment, booking, quotation and tracking pages out of search. Internal search pages are `noindex, follow`; sort/tracking parameters are excluded from canonicals. CSS, JS and public images are not blocked.
- Preview/deployment aliases have `noindex` response headers, a disallow-all robots file and an empty sitemap. Public pages point to the configured production origins.
- Escaped JSON-LD describes the platform, businesses, product/service details and breadcrumbs. Quotation, starting-price and property/enquiry listings never claim a purchasable fixed-price offer. No reviews or star ratings are invented. Structured data does not guarantee rich results.
- `/sell` is a public, indexable page explaining free storefront ownership. Registration, sign-in and identity verification forms remain non-indexable.
- Marketplace links from vendor subdomains permanently redirect to the canonical marketplace rather than a tenant 404.

## Google search-result icon and organization logo

These are separate signals, not a guarantee that Google will show a logo:

- The server-rendered homepage `<head>` advertises stable, square PNG favicons at
  `/brand/favicon-96.png` (96×96) and `/brand/icon-512.png` (512×512). Browser fallback
  `/favicon.ico` includes 16/32/48/96/256px images; `/icon.png` and `/apple-icon.png`
  use the same emblem. Icons use the existing shopping-bag/map/cart/orange-swoosh
  artwork without squeezing the entire wordmark/tagline into a tiny square.
- The homepage Organization JSON-LD identifies a separate full logo at
  `https://www.ibomvendorshub.com/brand/organization-logo.png` (1200×480, opaque white),
  with matching `url`, `contentUrl`, width and height. The visible website/email
  lockups and original source artwork remain unchanged.
- Exact public brand-image paths bypass tenant rewrites and page-level `noindex`
  headers. The production robots file allows these images and the homepage.
  Preview HTML remains noindexed and preview robots remain disallow-all.
- Regenerate from the owner's original PNG with
  `npm run brand:assets -- --search-only`. Keep the URLs stable; do not routinely
  append a new query token or change filenames on each deployment.

Google's [favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search)
requires a square image of at least 8px and recommends **larger than 48px** (not a
mandatory multiple of 48). Googlebot must be able to fetch the homepage and
Googlebot-Image the icon. Its [Organization logo guidance](https://developers.google.com/search/docs/appearance/structured-data/organization#logo)
requires a crawlable/indexable supported image of at least 112×112px that looks
right on white.

After a logo change is live, inspect **`https://www.ibomvendorshub.com/`** in Google
Search Console's URL Inspection tool, run **Test live URL**, then **Request indexing**
where available. Google extracts the favicon from the homepage, not from a sitemap
entry for the image. Refresh can take **several days to several weeks**, and Google
ultimately controls whether the icon or organization logo is displayed. Deploying
these files does not itself submit an indexing request or confirm search-result
appearance.

## One-time owner setup (not completed by code deployment)

Search engines choose whether/when to crawl, index and rank pages. A successful deployment or accessible sitemap is **not** evidence of indexing or rankings.

1. In [Google Search Console](https://search.google.com/search-console), add a **Domain property** for `ibomvendorshub.com`. Complete Google's DNS TXT ownership check in the domain's DNS settings. A Domain property covers the apex, `www` and vendor subdomains.
2. Submit `https://www.ibomvendorshub.com/sitemap.xml` and the live vendor sitemaps under the verified property. Inspect the homepage and important storefront/product URLs and use **Request indexing** where available.
3. In [Bing Webmaster Tools](https://www.bing.com/webmasters/), add the site or import the verified Search Console property, then submit the same relevant sitemaps. Inspect crawl/index coverage there too.
4. Monitor real indexing and search-performance reports. Keep vendor business names, descriptions, addresses, product photos and prices accurate and unique, and share actual storefront links on relevant business/social profiles.

If using **HTML meta-tag verification** instead of a Google Domain property, configure only the public token (the `content` value, not the full HTML tag):

```dotenv
GOOGLE_SITE_VERIFICATION=
BING_SITE_VERIFICATION=
```

Set these server environment variables in Vercel and redeploy. They generate `google-site-verification` and `msvalidate.01` meta tags. Google HTML verification verifies a URL-prefix property, **not** ownership of all vendor subdomains; prefer the Domain property. OAuth sign-in credentials are unrelated and must not be reused as verification tokens. No verification token is fabricated or assumed configured.

## Permanent Google HTML verification file

The owner's uploaded file is tracked at `public/google5165a16b9a302297.html` and served unchanged at:

`https://www.ibomvendorshub.com/google5165a16b9a302297.html`

**Leave this file in place after verification.** Do not rename it, change its contents, or remove it during cleanup or future deployments; Google can recheck it to retain ownership verification. It is a public verification token, not an account credential. No sign-in is required to retrieve it.

After deployment, the owner can click **Verify** for the matching URL-prefix property in Google Search Console. Hosting the file alone does not prove that Google has completed verification, submitted the sitemaps, or indexed the site. HTML-file verification does not replace DNS verification for a Domain property.

## Checks

```bash
npm run test:brand         # Icon/ICO bytes, legibility and public asset routing (no DB)
npm run test:seo           # Brand checks + SEO/local DB regression tests, rolled back
npm run typecheck
npm run lint
npm run build
npm run test:seo:http      # Running production build, default http://127.0.0.1:3010
```

Use `NEXT_PUBLIC_APP_URL=https://www.ibomvendorshub.com` and `NEXT_PUBLIC_ROOT_DOMAIN=ibomvendorshub.com` for production. HTTP tests simulate production Host headers against a local build; they do not need wildcard DNS or a remote database. `SEO_TEST_BASE_URL` can override the local test port. Do not run mutating fixture tests on production.

Before a sitemap approaches the protocol's 50,000-URL / 50-MB limits, partition it with a same-host sitemap index. Current storefronts are far below that threshold. Do not add unreliable `lastmod` dates on every request: entries either use persisted database timestamps or omit `lastmod`.
