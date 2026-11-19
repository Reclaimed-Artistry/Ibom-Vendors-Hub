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

## Checks

```bash
npm run test:seo           # Pure checks + local DB regression tests, rolled back
npm run typecheck
npm run lint
npm run build
npm run test:seo:http      # Running production build, default http://127.0.0.1:3010
```

Use `NEXT_PUBLIC_APP_URL=https://www.ibomvendorshub.com` and `NEXT_PUBLIC_ROOT_DOMAIN=ibomvendorshub.com` for production. HTTP tests simulate production Host headers against a local build; they do not need wildcard DNS or a remote database. `SEO_TEST_BASE_URL` can override the local test port. Do not run mutating fixture tests on production.

Before a sitemap approaches the protocol's 50,000-URL / 50-MB limits, partition it with a same-host sitemap index. Current storefronts are far below that threshold. Do not add unreliable `lastmod` dates on every request: entries either use persisted database timestamps or omit `lastmod`.
