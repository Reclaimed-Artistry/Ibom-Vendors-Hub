/** Repeatable site motion, native scrolling and performance/accessibility guards. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { installSiteMotion } from "../src/lib/site-motion";

async function main() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="progress" aria-hidden="true"></div>
    <main><h1 id="hero">Immediate page content</h1>
      <a class="card" id="first" href="/first">First card</a>
      <a class="card" id="repeat" href="/second"><h2 id="nested">Second card</h2></a>
      <div class="card" id="form"><form><h2>Form</h2><input aria-label="Name"></form></div>
      <div class="card" id="video"><video controls></video></div>
      <section aria-roledescription="carousel"><a class="card" href="/slide">Slide</a></section>
      <div class="sticky card" id="sticky">Sticky controls</div>
      <div data-scroll-effects="off"><a class="card" href="/opt-out">Opt out</a></div>
      <section inert aria-hidden="true"><h2 id="inactive">Inactive face</h2></section>
      <div class="ivh-login__background"></div>
    </main>
    <footer><div id="footer" data-scroll-reveal>Footer content</div></footer>
    <div role="dialog"><a class="card" href="/dialog">Dialog</a></div>
  </body></html>`, { url: "http://localhost:3000", pretendToBeVisual: true });
  const { window } = dom, { document } = window;
  Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node });
  let hidden = false, reduced = false, scroll = 0, height = 2000, heightReads = 0;
  Object.defineProperty(document, "hidden", { get: () => hidden });
  Object.defineProperty(window, "scrollY", { get: () => scroll });
  Object.defineProperty(window, "innerHeight", { value: 600 });
  for (const element of [document.documentElement, document.body]) Object.defineProperty(element, "scrollHeight", { get: () => { heightReads += 1; return height; } });
  const preference = new window.EventTarget();
  Object.defineProperty(preference, "matches", { get: () => reduced });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => preference });
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  window.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  window.cancelAnimationFrame = (id) => { frames.delete(id); };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(0); };
  let passiveScroll = false, scrollListeners = 0;
  const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  window.addEventListener = ((name: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => { if (name === "scroll") { scrollListeners += 1; passiveScroll = typeof options === "object" && Boolean(options?.passive); } add(name, callback, options); }) as typeof window.addEventListener;
  window.removeEventListener = ((name: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => { if (name === "scroll") scrollListeners -= 1; remove(name, callback, options); }) as typeof window.removeEventListener;

  class Observer {
    targets = new Set<Element>(); disconnected = false;
    constructor(readonly callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) { observers.push(this); }
    observe(element: Element) { this.targets.add(element); }
    unobserve(element: Element) { this.targets.delete(element); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    emit(element: Element, inside: boolean, top = 100, ratio = inside ? 0.8 : 0, visibleHeight = 30, visibleWidth = 300, width = 300) { this.callback([{ target: element, isIntersecting: inside, intersectionRatio: ratio, boundingClientRect: { top, width }, intersectionRect: { height: visibleHeight, width: visibleWidth } } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  }
  const observers: Observer[] = [];
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: Observer });
  class Sizes {
    disconnected = false;
    constructor(readonly callback: ResizeObserverCallback) { sizes.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  }
  const sizes: Sizes[] = [];
  Object.defineProperty(window, "ResizeObserver", { configurable: true, value: Sizes });
  const animations: Array<{ element: Element; keyframes: Keyframe[]; cancelled: boolean; options: KeyframeAnimationOptions }> = [];
  const animate: typeof Element.prototype.animate = function (this: Element, keyframes, options) {
    const animation = { element: this, keyframes: keyframes as Keyframe[], cancelled: false, options: options as KeyframeAnimationOptions };
    animations.push(animation);
    return { finished: new Promise<Animation>(() => {}), cancel: () => { animation.cancelled = true; } } as Animation;
  };
  Object.defineProperty(window.Element.prototype, "animate", { configurable: true, value: animate });
  const find = (id: string) => { const element = document.getElementById(id); assert(element); return element; };
  const progress = find("progress"), background = document.querySelector<HTMLElement>(".ivh-login__background")!;
  let cleanup = () => {};
  try {
    cleanup = installSiteMotion(progress);
    const observer = observers[0]; assert(observer); assert.equal(observers.length, 1);
    assert.equal(scrollListeners, 1); assert(passiveScroll);
    assert.deepEqual([...observer.targets].map((element) => element.id), ["hero", "first", "repeat", "inactive", "footer"]);
    assert(!observer.targets.has(find("nested")), "nested reveals do not stack transforms");
    assert.deepEqual(observer.options?.threshold, [0, 0.12, 0.5]);
    observer.emit(find("hero"), true); observer.emit(find("repeat"), false);
    assert.equal(animations.length, 0, "initial above-fold rendering is not delayed or faded");
    observer.emit(find("repeat"), true, 590, 0.01, 1);
    assert.equal(animations.length, 0, "do not animate at a fragile intersection boundary");
    observer.emit(find("repeat"), true);
    assert.equal(animations.length, 1); assert.equal(animations[0].options.duration, 700, "a moderate fly-in remains noticeable without a long wait");
    assert.equal(animations[0].options.easing, "cubic-bezier(.22,.68,.3,1)", "gentler easing avoids a rushed start and settles without bounce");
    assert.equal(animations[0].keyframes[0].opacity, 0.28, "a soft fade stays visible throughout the fly-in");
    assert.equal(animations[0].keyframes[0].translate, "-37.5px 0", "content flies from the left toward its resting position");
    assert.deepEqual(animations[0].keyframes[1], { opacity: 1, translate: "0 0" });
    assert.deepEqual(Object.keys(animations[0].keyframes[0]), ["opacity", "translate"], "no layout changes, blur or expensive effects");
    observer.emit(find("repeat"), true); assert.equal(animations.length, 1, "no repeat animations while staying in view");
    observer.emit(find("repeat"), false); assert(animations[0].cancelled);
    observer.emit(find("repeat"), true, -10); assert.equal(animations.length, 2);
    assert.equal(animations[1].keyframes[0].translate, "-37.5px 0", "scrolling upward replays the same left-to-right fly-in, not a vertical or reversed effect");
    find("repeat").focus(); assert(animations[1].cancelled, "focus immediately stabilises the interactive target");
    observer.emit(find("repeat"), false); observer.emit(find("repeat"), true); assert.equal(animations.length, 2, "focused content is never moved");
    find("repeat").blur(); observer.emit(find("repeat"), false); observer.emit(find("repeat"), true);
    find("nested").dispatchEvent(new window.Event("pointerdown", { bubbles: true })); assert(animations[2].cancelled);
    observer.emit(find("inactive"), false); observer.emit(find("inactive"), true); assert.equal(animations.length, 3, "an inert login face is never animated");
    observer.emit(find("hero"), false); observer.emit(find("hero"), true, 590, 0.12, 30, 2);
    assert.equal(animations.at(-1)?.keyframes[0].translate, "-0.8px 0", "a small visible horizontal edge cannot translate itself out of view and create an idle replay loop");
    observer.emit(find("footer"), false); observer.emit(find("footer"), true, 100, 0.8, 30, 1200, 1200);
    assert.equal(animations.at(-1)?.keyframes[0].translate, "-56px 0", "wide sections have bounded travel rather than crossing the screen");
    observer.emit(find("first"), false); observer.emit(find("first"), true, 100, 0.8, 30, 160, 160);
    assert.equal(animations.at(-1)?.keyframes[0].translate, "-20px 0", "small cards use proportionately shorter travel");
    console.log("PASS: sleek left-to-right fly-ins replay in both scroll directions; responsive/visible-width travel bounds; no nested, form, player, carousel, sticky, modal, focused-target or intersection-edge jitter");

    flush(); assert.equal(frames.size, 0, "there is no continuous animation frame loop");
    assert.equal(progress.dataset.scrollable, "true"); assert.equal(progress.style.getPropertyValue("--ivh-scroll-progress"), "0.0000");
    const measured = heightReads;
    scroll = 700;
    for (let index = 0; index < 100; index += 1) window.dispatchEvent(new window.Event("scroll"));
    assert.equal(frames.size, 1, "100 scroll events batch into one frame, not 100 React renders"); flush();
    assert.equal(progress.style.getPropertyValue("--ivh-scroll-progress"), "0.5000");
    assert.equal(background.style.getPropertyValue("--ivh-login-scroll"), "600.0px");
    assert.equal(heightReads, measured, "scroll frames use cached document dimensions, not repeated layout measurements");
    scroll = -10; window.dispatchEvent(new window.Event("scroll")); flush(); assert.equal(progress.style.getPropertyValue("--ivh-scroll-progress"), "0.0000");
    height = 600; window.dispatchEvent(new window.Event("resize")); flush(); assert.equal(progress.dataset.scrollable, "false");
    assert.equal(progress.style.getPropertyValue("--ivh-scroll-progress"), "0.0000");
    console.log("PASS: passive native scrolling, event-driven/rAF-batched progress, cached size reads, clamped decorative login parallax and no idle frame loop");

    const added = document.createElement("a"); added.className = "card"; added.href = "/new"; added.textContent = "Streamed card";
    document.querySelector("main")!.append(added); await Promise.resolve(); assert(observer.targets.has(added), "client-navigation/filter/streamed content is observed without polling");
    observer.emit(added, false); observer.emit(added, true); const running = animations.at(-1)!;
    added.remove(); await Promise.resolve(); assert(!observer.targets.has(added)); assert(running.cancelled);
    hidden = true; document.dispatchEvent(new window.Event("visibilitychange"));
    window.dispatchEvent(new window.Event("scroll")); assert.equal(frames.size, 0, "hidden tabs schedule no decoration work");
    hidden = false; document.dispatchEvent(new window.Event("visibilitychange")); assert.equal(frames.size, 1);
    reduced = true; preference.dispatchEvent(new window.Event("change"));
    assert(observer.disconnected && sizes[0].disconnected); assert.equal(frames.size, 0); assert.equal(scrollListeners, 0);
    assert.equal(progress.dataset.scrollable, undefined); assert.equal(progress.style.cssText, ""); assert.equal(background.style.cssText, "");
    const count = animations.length; observer.emit(find("repeat"), false); observer.emit(find("repeat"), true); assert.equal(animations.length, count, "stale callbacks cannot animate after cleanup/preference changes");
    reduced = false; preference.dispatchEvent(new window.Event("change")); assert.equal(observers.length, 2);
    cleanup(); assert.equal(scrollListeners, 0); assert.equal(frames.size, 0);
    console.log("PASS: dynamic-node registration/removal, hidden-tab pause, live reduced-motion/forced-color preference cleanup and leak-free route teardown");

    Object.defineProperty(window.Element.prototype, "animate", { configurable: true, value: undefined });
    const countBefore = observers.length; cleanup = installSiteMotion(progress); flush();
    assert.equal(observers.length, countBefore); assert(!find("first").hasAttribute("style")); cleanup();
    reduced = true; cleanup = installSiteMotion(progress); assert.equal(frames.size, 0); assert.equal(scrollListeners, 0); cleanup();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    cleanup = installSiteMotion(progress); assert.equal(frames.size, 0); cleanup();
    console.log("PASS: unsupported animation/preference APIs and motion-restricted users keep ordinary visible, usable content");

    const css = readFileSync("src/app/motion.css", "utf8"), source = readFileSync("src/lib/site-motion.ts", "utf8");
    assert(css.includes("(hover: hover) and (pointer: fine)"));
    assert(css.includes(':not(:disabled):not([aria-disabled="true"]):hover'));
    assert(css.includes("(prefers-reduced-motion: reduce)")); assert(css.includes("html { scroll-behavior: auto; }"));
    assert(css.includes("(forced-colors: active), print"));
    assert(!/setInterval|setTimeout|preventDefault|scrollTo\(/.test(source), "no timers, polling or scroll hijacking");
    assert(readFileSync("src/app/layout.tsx", "utf8").includes("<SiteMotion />"), "all route groups share the enhancement without wrapping/rebuilding their server content");
    assert(readFileSync("src/components/site-motion.tsx", "utf8").includes("requestIdleCallback"));
    console.log("PASS: touch-safe hover/disabled-control guards, reduced-motion CSS, print fallback, idle startup and no animation dependency or scroll interception");
  } finally { cleanup(); dom.window.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
