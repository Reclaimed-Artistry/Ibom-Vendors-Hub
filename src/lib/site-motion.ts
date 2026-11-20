/** Progressive, compositor-only decoration. Content is never hidden to await JS. */
const REVEAL_TARGETS = "main h1, main h2, main .card, [data-scroll-reveal], .ivh-login__brand, .ivh-login__switch-area, .ivh-login__vendor, .ivh-login__back";
const STATIC_EXCLUSIONS = "header, nav, aside, form, [role='dialog'], [aria-modal='true'], [aria-roledescription='carousel'], [data-scroll-effects='off']";
const INTERACTIVE_CONTENT = "form, input, textarea, select, video, audio, iframe, .sticky, .fixed";
const MOTION_PREFERENCE = "(prefers-reduced-motion: reduce), (forced-colors: active), print";

type RevealState = { inside?: boolean; animation?: Animation };

/** One shared observer and one event-driven frame, never a render/loop per card. */
export function installSiteMotion(progress: HTMLElement | null): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const preference = window.matchMedia(MOTION_PREFERENCE);
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  let dispose: (() => void) | undefined;

  function enable() {
    let stopped = false, frame = 0, needsMeasurement = true, range = 0;
    let lastProgress = "", lastParallax = "";
    const parallax = document.querySelector<HTMLElement>(".ivh-login__background");
    const tracked = new Map<HTMLElement, RevealState>();
    const cancel = (state: RevealState) => { state.animation?.cancel(); state.animation = undefined; };
    const cancelAll = () => { for (const state of tracked.values()) cancel(state); };

    const observer = typeof window.IntersectionObserver === "function" && typeof Element.prototype.animate === "function"
      ? new window.IntersectionObserver((entries) => {
        if (stopped) return;
        for (const entry of entries) {
          const element = entry.target as HTMLElement, state = tracked.get(element);
          if (!state) continue;
          // Above-the-fold content paints immediately, with no intro/LCP delay.
          if (state.inside === undefined) { state.inside = entry.isIntersecting; continue; }
          if (!entry.isIntersecting) { state.inside = false; cancel(state); continue; }
          if (state.inside || entry.intersectionRatio < 0.12) continue;
          state.inside = true;
          // Keep watching after exit so scrolling back replays the effect.
          if (document.hidden || element.contains(document.activeElement) || element.closest("[inert], [aria-hidden='true']")) continue;
          cancel(state);
          // Stay inside the observed area: the animation must not trigger its
          // own exit/re-entry loop when someone stops scrolling at an edge.
          const distance = Math.min(12, entry.intersectionRect.height * 0.4);
          try {
            const animation = element.animate([
              { opacity: 0.68, translate: `0 ${entry.boundingClientRect.top < 0 ? -distance : distance}px` },
              { opacity: 1, translate: "0 0" },
            ], { duration: 420, easing: "cubic-bezier(.2,.65,.3,1)" });
            state.animation = animation;
            void animation.finished.then(() => { if (state.animation === animation) state.animation = undefined; }).catch(() => {});
          } catch { /* Unsupported animation APIs leave ordinary visible content. */ }
        }
      }, { threshold: [0, 0.12, 0.5] })
      : undefined;

    function register(element: HTMLElement) {
      if (!observer || tracked.has(element) || element.closest(STATIC_EXCLUSIONS)) return;
      // Do not stack transforms, move a form/player, or affect fixed/sticky UI.
      if (element.parentElement?.closest(".card, [data-scroll-reveal]") || element.matches("form, .sticky, .fixed") || element.querySelector(INTERACTIVE_CONTENT)) return;
      tracked.set(element, {});
      observer.observe(element);
    }
    function discover(root: ParentNode) {
      if (root instanceof HTMLElement && root.matches(REVEAL_TARGETS)) register(root);
      root.querySelectorAll<HTMLElement>(REVEAL_TARGETS).forEach(register);
    }
    if (observer) discover(document);

    // App Router navigation, filters and streamed/live content need no polling.
    const mutations = observer && typeof window.MutationObserver === "function" ? new window.MutationObserver((records) => {
      if (stopped) return;
      for (const [element, state] of tracked) {
        if (!element.isConnected) { cancel(state); observer.unobserve(element); tracked.delete(element); }
      }
      for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) discover(node);
    }) : undefined;
    mutations?.observe(document.body, { childList: true, subtree: true });

    function render() {
      frame = 0;
      if (stopped || document.hidden) return;
      if (needsMeasurement) {
        range = Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight);
        needsMeasurement = false;
        if (progress) progress.dataset.scrollable = String(range > 0);
      }
      const y = Math.max(0, window.scrollY);
      const value = (range ? Math.min(1, y / range) : 0).toFixed(4);
      if (progress && value !== lastProgress) { progress.style.setProperty("--ivh-scroll-progress", value); lastProgress = value; }
      const offset = `${Math.min(y, 600).toFixed(1)}px`;
      if (parallax && offset !== lastParallax) { parallax.style.setProperty("--ivh-login-scroll", offset); lastParallax = offset; }
    }
    function schedule() { if (!stopped && !document.hidden && !frame) frame = window.requestAnimationFrame(render); }
    const resize = () => { needsMeasurement = true; schedule(); };
    const visibility = () => {
      if (document.hidden) { cancelAll(); window.cancelAnimationFrame(frame); frame = 0; }
      else resize();
    };
    const protectInteraction = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      for (const [element, state] of tracked) if (state.animation && element.contains(event.target)) cancel(state);
    };
    const sizes = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(resize) : undefined;
    sizes?.observe(document.documentElement);
    sizes?.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("focusin", protectInteraction);
    document.addEventListener("pointerdown", protectInteraction, { passive: true });
    schedule();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusin", protectInteraction);
      document.removeEventListener("pointerdown", protectInteraction);
      observer?.disconnect(); mutations?.disconnect(); sizes?.disconnect();
      cancelAll(); tracked.clear();
      progress?.style.removeProperty("--ivh-scroll-progress");
      if (progress) delete progress.dataset.scrollable;
      parallax?.style.removeProperty("--ivh-login-scroll");
    };
  }

  function updatePreference() {
    dispose?.(); dispose = undefined;
    if (!preference.matches && !connection?.saveData) dispose = enable();
  }
  updatePreference();
  preference.addEventListener("change", updatePreference);
  return () => { preference.removeEventListener("change", updatePreference); dispose?.(); };
}
