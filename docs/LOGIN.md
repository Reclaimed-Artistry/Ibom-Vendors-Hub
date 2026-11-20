# Login design

The `/login` screen adapts the owner's supplied `index.html`, `style.css` and
`script.js`: soft neumorphic surfaces, floating background circles and labels,
electric focus borders, independent password reveal buttons, and a 3D flip
between login and account creation. Its forest-green backdrop, emerald/gold
floating circles, focus glows and animated buttons now reuse the marketplace's
shared theme tokens rather than the demo's grey-and-blue palette.

## Implementation and scope

- `src/app/(login)/login/page.tsx` keeps the existing login URL, server-side
  authenticated-user redirects, checkout notices, password-reset success,
  Google OAuth messages and conditional real Google buttons. It explicitly
  retains private/noindex metadata.
- Login has its own route group so the new full-screen design does **not** wrap
  registration, password reset, verification, the marketplace or storefronts.
- `src/components/login-experience.tsx` uses the existing password-login and
  customer-registration server actions. The demo's fake success timeout and
  global document event handlers are not included.
- All CSS and animations are namespaced with `ivh-login`; no global body/heading
  resets or `overflow: hidden` viewport lock are imported from the demo.
- Poppins is self-hosted through the pinned `@fontsource/poppins` package (OFL).
  Icons use the existing local Lucide package, not Font Awesome's CDN.
- Colors reference `--color-ink-*`, `--color-brand-*` and `--color-gold-*` from
  `globals.css`, matching the marketplace hero. The pale card keeps its soft
  shadows; decorative circles, rotating electric borders, focus glow, controls
  and animated button fills use the site's greens and golds, not a separate
  blue palette. The dark-backdrop footer has contrasting text and gold focus.
- The real platform logo is preserved on its existing white chip so it remains
  legible on the dark backdrop. The lock/user emblems mirror the supplied
  design without replacing the site's brand artwork or search favicons.

## Working interactions

- Login verifies the actual password, handles inactive/Google-only accounts,
  preserves rate limits and sends vendors, customers and admins to their
  existing destinations. Safe `next` values carry through checkout and signup;
  external/protocol-relative/backslash redirects remain rejected.
- **Remember me** sets the existing HTTP-only, SameSite=Lax, shared first-party
  session cookie for up to 30 days. Unchecked creates a browser-session cookie,
  with no Max-Age/Expires. Browsers may restore session cookies when restoring a
  browser session; no password or token is stored in localStorage. Other auth
  flows keep their existing persistent-cookie default.
- The reverse face creates a real shopping account, including password hashing,
  a customer profile, terms acceptance and the existing verification/welcome
  email flow. Confirmation is checked both in the UI and on the server. The
  older standalone registration form stays compatible without that optional
  confirmation field; an existing account cannot be silently duplicated.
- The signup face uses the backend's existing optional-phone support; customers
  can supply their contact number in their profile/checkout. Storefront creation
  still goes through `/register` and its existing business verification; it is
  not replaced by this short account form.
- Both faces retain vendor-registration links. Forgot password points to the
  real reset flow. The circular signup link has a real registration URL for
  JavaScript-disabled browsers and open-in-new-tab, rather than a dead `#` link.
- Only the visible face is interactive: the other is inert, aria-hidden and its
  fieldset disabled. Focus follows the active heading. Inputs have unique IDs,
  real labels, autocomplete hints and associated validation errors. Requests
  expose busy/pending state, and errors never claim success.
- Shared [site-wide motion](SITE_MOTION.md) adds repeating scroll reveals to
  headings/accents, an emerald/gold scroll-progress line and bounded parallax on
  decorative circles only. Inputs stay stationary and keep native focus/scroll.
- Card height follows active content. Narrow/short viewports can scroll to all
  controls and messages. Reduced-motion users get no decorative animation or
  animated flip; focus borders and controls still work. Forced-colors users
  retain visible boundaries.

## Checks

```bash
npm run test:login        # DOM interactions, validation, auth navigation, shared palette and color contrast; no DB writes
npm run test:login:http   # Local-only real form actions, cookie options and account/reset workflows
npm run typecheck
npm run lint
npm run build
```

The HTTP suite requires a running **local** build at port 3000 and a local test
DB. `LOGIN_TEST_BASE_URL` can override the local port. Start that local server
with the same fixture `AUTH_SECRET` as `LOGIN_TEST_AUTH_SECRET` (default
`local-category-preview-auth-secret-only`); never use that public test value in
production. Disable local SMTP credentials for fixture emails. The suite
rejects non-local server/database hosts and removes its fixture users, tokens,
profiles, activity and email logs in `finally`. It tests actual password login,
role/checkout redirects, inactive and Google-only accounts, remember-me cookie
persistence, confirmation/terms/duplicate rejection, real signup, legacy signup,
and the complete password-reset path. It does not claim a live Google OAuth
round trip or email inbox delivery.
