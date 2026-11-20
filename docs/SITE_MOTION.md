# Site-wide scroll and hover effects

`SiteMotion` mounts once in the root layout, covering the marketplace, vendor
storefronts, dashboards and auth pages without turning their server-rendered
content into client components. The approved emerald/gold palette is unchanged.

## What moves

- A slim emerald/gold progress accent follows the current document's native
  scroll position. It is decorative, ignores pointer events and disappears on
  pages that do not need scrolling.
- Eligible cards, headings, footer content and login accents gently fade/lift
  into view. **They replay after leaving and re-entering the viewport**, in
  either direction, rather than running only on the first visit. Initially
  visible content paints immediately, without waiting for an intro animation.
- Login's decorative background circles gain a small, bounded depth effect.
  Their independent floating animation and the flip card remain intact; inputs
  do not move with the background.
- On fine pointers with actual hover, linked cards lift slightly, shared buttons
  respond to hover/press, navigation/footer links gain feedback, and field
  borders respond. Touch devices do not get sticky hover transforms. Disabled
  or aria-disabled controls do not lift. Keyboard focus stays visible.

## Speed and safety

- No animation package, CDN, new media, API requests or database changes.
- Startup waits for idle time (or the next frame on browsers without an idle
  callback). One IntersectionObserver handles all reveal targets, including
  those added by client navigation, filters and streamed/live content.
- Reveal animations use only opacity and independent translation for 420 ms.
  They never change layout, hide content pending JS, or use `fill: forwards`.
  A visible-area guard prevents exit/re-entry jitter at intersection edges.
- The single scroll listener is passive and coalesces events into one requested
  animation frame. Document height is cached and refreshed on resize/content
  size changes. There is no continuous frame loop, polling or React state update
  on scroll. Native scrolling, history restoration, anchors and zoom are retained.
- Forms, players, carousels, sticky controls, dialogs and nested cards are excluded
  from reveals. Focus/pointer interaction cancels a reveal immediately. Existing
  viewport video autoplay and manual pause behavior are not replaced.
- Removed nodes, route changes and hidden tabs release/cancel work. Reduced-motion,
  forced-colors and print preferences stop scroll decoration; changes apply live.
  Save-Data skips the JS decoration. The enhancement never adds a hidden-until-JS
  state; unavailable browser APIs leave existing page content undecorated.
  No-JS browser coverage confirms the login fallback, not every streamed
  marketplace route's independent rendering behavior.

Use `data-scroll-reveal` for an additional independent content block,
`data-hover-card` for an explicitly interactive surface, or
`data-scroll-effects="off"` to exclude a subtree from reveals. Do not opt forms,
fixed/sticky ancestors or large application shells into transforms.

## Checks

```bash
npm run test:motion
npm run test:login
npm run typecheck
npm run lint
npm run build
```

The motion suite checks both-direction replays, intersection-edge bounds,
initial paint, focus/pointer protection, exclusions, streamed nodes, passive
scroll listeners, frame batching/cached geometry, hidden tabs, live preference
changes, browser fallbacks and cleanup. Browser QA additionally covers repeated
scrolling/hover on the marketplace and storefront, client-side navigation,
mobile/touch, login/signup, reduced motion, keyboard access and idle stability.
Use local fixtures for any authentication/product/cart mutations; production
verification is read-only.
