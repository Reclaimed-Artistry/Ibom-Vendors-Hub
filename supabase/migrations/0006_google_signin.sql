-- ---------------------------------------------------------------------------
-- 0006 · "Sign in with Google" credentials managed from the admin dashboard
--
-- The OAuth client used to be configurable only through Vercel environment
-- variables, which meant every credential change needed a redeploy and could
-- only be done by whoever owns the Vercel project. Storing the pair here lets
-- the platform owner paste it in Admin -> Platform settings and switch the
-- feature on or off instantly. Environment variables still work as a fallback
-- for deployments that prefer them.
--
-- The secret is only ever read server-side (systemDb) and is never rendered
-- back into the browser; the admin form shows an empty password field with a
-- "stored" hint, exactly like the Paystack secret.
-- ---------------------------------------------------------------------------

alter table platform_settings
  add column if not exists google_client_id      text,
  add column if not exists google_client_secret  text,
  add column if not exists google_signin_enabled boolean not null default true;

comment on column platform_settings.google_client_id is
  'OAuth 2.0 Web client ID from Google Cloud Console (…apps.googleusercontent.com).';
comment on column platform_settings.google_client_secret is
  'OAuth 2.0 client secret. Server-side only; never exposed to the browser.';
comment on column platform_settings.google_signin_enabled is
  'Kill switch for the "Continue with Google" button, independent of the stored credentials.';
