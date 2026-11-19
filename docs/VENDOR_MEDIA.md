# Vendor listing media

## Scope and formats

Both the guided and full product/service editors use the same media picker. A listing has at most **10 files total**, including existing photos. Each uploaded file may be at most **104,857,600 bytes (100 MiB, displayed as 100 MB)**. Files larger than this are rejected before transfer and on the server/storage side. There is no subscription charge or trial added by this feature.

Supported uploads:

- Images: JPEG/JPG, PNG, WebP, animated GIF, AVIF.
- Video: MP4, M4V (stored as MP4), WebM, MOV/QuickTime.
- Audio: MP3, WAV, OGG/OGA, M4A.

Files retain their original bytes: no canvas conversion that would flatten animation or remove audio. MP4 with H.264 video/AAC audio is recommended for broad device compatibility. Container support does not guarantee every codec is playable; customers get an open-file fallback. Players do not autoplay. Cards use muted video previews with metadata-only preloading, or an audio indicator. The accessible listing gallery lets customers select **all** files and play video/audio with native controls.

Store logos/covers, registration/KYC documents and payment receipts retain their separate existing image/document rules and limits. This is listing media, not a new social feed or document-sharing feature. Optional external **image** links remain compatible; videos/audio must use verified uploads. The 100 MB upload limit is not a promise about the size/availability of externally hosted image links.

## Upload protocol and authorization

1. The signed-in, operational vendor sends small JSON file metadata to `POST /api/vendor-media`. Cross-origin requests and non-vendor/suspended users are rejected. A serverless-safe persistent issuance throttle supplements the per-process request throttle.
2. The server chooses a random, store-scoped object path, creates a pending `vendor_media_uploads` record, and issues a **non-overwriting, single-object signed upload URL**. The Supabase service-role key never leaves the server.
3. The browser sends the original file directly to that URL with progress/cancellation. A 100 MB file is **not** sent through a Next server action or Vercel function (which has a much smaller request limit). Merely raising `serverActions.bodySizeLimit` would not solve this.
4. `POST /api/vendor-media/<id>` verifies the vendor's ownership, expiry, actual stored length, stored MIME and the file's byte signature. It reads at most a 4 KiB prefix, not the complete 100 MB body. Invalid files are marked failed and removed. A storage URL/extension alone is not accepted as verification.
5. The listing form submits verified upload IDs, not trusted client-supplied media URLs or MIME/size claims. Its transaction enforces ownership/readiness and the combined 10-file limit. Existing legacy images remain valid. A database trigger also prevents attaching another store's upload or forging its metadata.

`product_images` is deliberately retained (including old URLs/order) for compatibility, with nullable `mime_type`, `byte_size` and `upload_id`. Never repurpose the private catalogue `products.category_id` or alter marketplace category assignments for a media-only edit.

The verification table has RLS with owner/admin reads and **no actor write policy**. Only trusted server code can mark an upload ready. Pending uploads expire after two hours; verified, unattached uploads have a 24-hour save window. The secret-protected daily cron locks and claims expired/unattached uploads as failed **before** deleting their objects; the attachment trigger takes a conflicting lock, so a concurrent save cannot lose its file. Failed storage deletions retain receipts for retry. Published media remain valid after their upload session expires, but expired receipts cannot create new attachments. Deleting a listing leaves its verified files for this receipt-aware cleanup, preserving any shared references. Legacy orphan pruning observes a 48-hour grace period and excludes UUID-named media managed by receipts.

## Storage setup — important 100 MB prerequisite

Migration `0031_vendor_listing_media.sql` configures the existing `storefronts` bucket for the allowlist and a 104,857,600-byte per-object limit. If `SUPABASE_STORAGE_BUCKET` points to a custom bucket, apply the equivalent settings to that bucket too. The existing public-read bucket is reused; no new paid provider or plan is provisioned.

**The Supabase project-wide global limit must also permit 100 MB.** A per-bucket setting cannot override a lower global/plan limit. Supabase documents that **Free projects allow at most 50 MB per file; Pro and above are required for files above 50 MB**:

<https://supabase.com/docs/guides/storage/uploads/file-limits>

An owner with a suitable plan must set **Storage → Settings → Global file size limit** to at least 100 MB. Do not upgrade billing automatically, claim an account is on Pro without checking, or claim live 100 MB provider acceptance merely because the bucket/SQL/app limit was changed. The connected project's global setting/plan is not exposed by the available management tools. The picker reports a useful provider-limit error if storage refuses a large file. No paid plan changes are part of this implementation.

Hosted deployment requires `NEXT_PUBLIC_SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY` and optionally `SUPABASE_STORAGE_BUCKET` (default `storefronts`). There is no ephemeral-disk or inline data-URI fallback for large media on Vercel.

For local development without storage credentials, authenticated uploads stream to ignored `.data/vendor-media`; the local `/api/vendor-media/<uuid>.<extension>` delivery endpoint supports HEAD and byte ranges for playback/seeking. This local sink is disabled when Supabase is configured or on a serverless host. It is not a production upload proxy.

## Rendering and SEO

The shared media renderer covers editor previews, marketplace/home/catalogue cards, storefront highlights/carousel, listing gallery, service booking preview, vendor catalogue and carts. It never sends a video/audio URL to an `<img>` element. Social-preview and structured-data `image` fields select only actual images, falling back to store/platform artwork where needed; videos are not falsely labelled as images or given fabricated VideoObject metadata.

## Tests

- `npm run test:media`: allowlists/aliases, inclusive size boundary, signatures, signed storage protocol, verification/expiry/invalid-file cleanup, real `app_runtime` RLS, metadata and cross-store attachment guards, image-only SEO, and unchanged GIF/direct-transfer client behavior. Storage network calls are mocked; no production files are written.
- `MEDIA_TEST_BASE_URL=http://127.0.0.1:3000 npm run test:media:http`: **local server/database only**. Actual GIF/MP4/WAV transfers, original bytes, a real 100 MiB HTTP upload with hash comparison, range/HEAD behavior, auth/origin/suspension guards, actual listing save/edit actions, cross-store rejection and atomic combined-count enforcement. Fixtures and uploaded files are cleaned. Tiny original fixtures live under `scripts/fixtures/vendor-media`; no large binary is committed.
- `npm run test:multi-categories`, `npm run test:seo`, `npm run test:seo:http`, smoke checks, typecheck, lint and build protect the existing listing/category/storefront flows.

Local boundary/mock tests prove the application path; they do **not** establish the production Supabase account's plan/global limit, live provider acceptance of a 100 MB object, or playback of every third-party codec.
