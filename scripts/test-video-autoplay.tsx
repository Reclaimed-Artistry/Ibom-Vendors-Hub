/** Playback policy and renderer integration. Media/browser APIs are mocked here. */
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";

async function main() {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost:3000", pretendToBeVisual: true,
  });
  const window = dom.window;
  const document = window.document;
  Object.assign(globalThis, { window, self: window, document, HTMLElement: window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true });
  let hidden = false, reducedMotion = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  const motion = new window.EventTarget();
  Object.defineProperty(motion, "matches", { get: () => reducedMotion });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => motion });
  const errors: unknown[] = [];
  const onRejection = (error: unknown) => errors.push(error);
  process.on("unhandledRejection", onRejection);
  window.addEventListener("error", event => errors.push(event.message));

  class Observer {
    targets = new Set<Element>();
    disconnected = false;
    constructor(readonly callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) { observers.push(this); }
    observe(target: Element) { this.targets.add(target); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    emit(target: Element, ratio: number) {
      this.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }
  const observers: Observer[] = [];
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: Observer });
  type MediaState = { paused: boolean; ended: boolean; plays: number; pauses: number };
  const states = new WeakMap<HTMLMediaElement, MediaState>();
  const state = (video: HTMLMediaElement) => {
    let result = states.get(video);
    if (!result) { result = { paused: true, ended: false, plays: 0, pauses: 0 }; states.set(video, result); }
    return result;
  };
  let nextPlay: "allow" | "reject" | "throw" | "defer" = "allow";
  let finishPlay: (() => void) | undefined;
  Object.defineProperties(window.HTMLMediaElement.prototype, {
    paused: { configurable: true, get(this: HTMLMediaElement) { return state(this).paused; } },
    ended: { configurable: true, get(this: HTMLMediaElement) { return state(this).ended; } },
    play: { configurable: true, value(this: HTMLMediaElement) {
      const current = state(this), behavior = nextPlay; nextPlay = "allow"; current.plays += 1;
      if (behavior === "throw") throw new Error("Synchronous playback failure");
      if (behavior === "reject") return Promise.reject(new window.DOMException("Gesture required", "NotAllowedError"));
      current.paused = false;
      queueMicrotask(() => this.dispatchEvent(new window.Event("play")));
      if (behavior === "defer") return new Promise<void>(resolve => { finishPlay = () => { current.paused = false; resolve(); }; });
      return Promise.resolve();
    } },
    pause: { configurable: true, value(this: HTMLMediaElement) {
      const current = state(this);
      if (current.paused) return;
      current.paused = true; current.pauses += 1;
      queueMicrotask(() => this.dispatchEvent(new window.Event("pause")));
    } },
  });

  const { createRoot } = await import("react-dom/client");
  const { ListingMedia } = await import("../src/components/listing-media");
  const { ProductMediaGallery } = await import("../src/components/product-media-gallery");
  const root = createRoot(document.getElementById("root")!);
  const query = <T extends Element>(selector: string) => { const element = document.querySelector<T>(selector); assert(element, selector); return element; };
  const observerFor = (video: Element) => { const observer = observers.find(item => item.targets.has(video)); assert(observer, "video is observed"); return observer; };
  const intersect = async (video: Element, ratio: number) => { await act(async () => observerFor(video).emit(video, ratio)); };
  const visibility = async (value: boolean) => { await act(async () => { hidden = value; document.dispatchEvent(new window.Event("visibilitychange")); }); };
  const preference = async (value: boolean) => { await act(async () => { reducedMotion = value; motion.dispatchEvent(new window.Event("change")); }); };
  try {
    await act(async () => root.render(<ListingMedia src="/first.mp4" alt="First clip" player />));
    let video = query<HTMLVideoElement>("video");
    assert(video.muted && video.playsInline && video.controls);
    assert.equal(video.preload, "none");
    assert.equal(video.autoplay, false, "no unconditional HTML autoplay for off-screen media");
    assert.deepEqual(observerFor(video).options?.threshold, [0, 0.5]);
    await intersect(video, 0); await intersect(video, 0.49);
    assert.equal(state(video).plays, 0, "off-screen/mostly clipped videos do not start");
    await intersect(video, 0.5);
    assert.equal(state(video).plays, 1); assert.equal(video.paused, false);
    video.muted = false; // The native sound control remains effective while watching.
    await intersect(video, 0.9);
    assert.equal(state(video).plays, 1); assert.equal(video.muted, false);
    await intersect(video, 0);
    assert(video.paused);
    await intersect(video, 0.8);
    assert.equal(state(video).plays, 2); assert(video.muted);
    await visibility(true); assert(video.paused);
    await visibility(false); assert.equal(video.paused, false);
    assert.equal(state(video).plays, 3);
    console.log("PASS: viewport-only muted/inline playback, off-screen pause, hidden-tab pause/resume and usable sound controls");

    await act(async () => video.pause());
    await intersect(video, 0.4); await intersect(video, 0.8);
    await visibility(true); await visibility(false);
    assert.equal(state(video).plays, 3, "automatic updates never fight an explicit pause");
    await act(async () => { await video.play(); });
    await intersect(video, 0); await intersect(video, 0.8);
    assert.equal(state(video).plays, 5, "native Play restores normal viewport behavior");
    await preference(true); assert(video.paused);
    await intersect(video, 0); await intersect(video, 0.8);
    assert.equal(state(video).plays, 5);
    await act(async () => { await video.play(); });
    assert.equal(video.paused, false, "reduced-motion users can still play manually");
    await intersect(video, 0); await preference(false); await intersect(video, 0.8);
    assert.equal(video.paused, false);
    console.log("PASS: explicit pause respected, manual playback works, reduced-motion changes stop automatic motion");

    await intersect(video, 0);
    nextPlay = "reject"; await intersect(video, 0.8);
    assert(video.paused && video.controls, "blocked autoplay leaves native controls available");
    await intersect(video, 0); nextPlay = "throw"; await intersect(video, 0.8);
    assert(video.paused);
    await intersect(video, 0); nextPlay = "defer"; await intersect(video, 0.8);
    await intersect(video, 0); assert(video.paused);
    assert(finishPlay); await act(async () => finishPlay!());
    assert(video.paused, "a late play promise cannot restart an off-screen clip");
    console.log("PASS: browser rejection/synchronous failure and rapid scroll-versus-play races are handled");

    await intersect(video, 0.8);
    const previous = video, previousObserver = observerFor(video);
    await act(async () => root.render(<ListingMedia src="/first.mp4" alt="First clip" player autoPlayInView={false} />));
    assert(previous.paused && previousObserver.disconnected);
    const playsBefore = state(previous).plays;
    previousObserver.emit(previous, 1); await visibility(true); await visibility(false);
    assert.equal(state(previous).plays, playsBefore, "disabled/unmounted observers and listeners cannot restart media");
    assert.equal(video.loop, false);
    await act(async () => root.render(<ListingMedia key="preview" src="/preview.mp4" alt="Editor preview" autoPlayInView={false} />));
    video = query<HTMLVideoElement>("video");
    assert.equal(observers.filter(item => item.targets.has(video)).length, 0);
    assert.equal(state(video).plays, 0); assert.equal(video.loop, false);
    console.log("PASS: opt-out previews stay still and effect cleanup disconnects/stops previous videos");

    await act(async () => root.render(<ProductMediaGallery name="Mixed media" items={[
      { url: "/one.mp4" }, { url: "/two.mp4" }, { url: "/sound.m4a" },
    ]} />));
    video = query<HTMLVideoElement>("video[controls]");
    assert.equal(observers.filter(item => !item.disconnected).length, 1, "only the selected gallery player is observed, never thumbnails");
    await intersect(video, 0.8); assert.equal(video.paused, false);
    const first = video;
    await act(async () => query<HTMLButtonElement>('button[aria-label="View video 2 of 3"]').click());
    assert(first.paused);
    video = query<HTMLVideoElement>("video[controls]"); assert.notEqual(video, first);
    await intersect(video, 0.8); assert.equal(video.paused, false);
    await act(async () => query<HTMLButtonElement>('button[aria-label="View audio 3 of 3"]').click());
    assert(video.paused);
    const audio = query<HTMLAudioElement>("audio");
    assert.equal(state(audio).plays, 0); assert.equal(audio.autoplay, false);
    assert.equal(observers.filter(item => !item.disconnected).length, 0);
    console.log("PASS: gallery selection stops the previous video; thumbnails and audio never autoplay");

    await act(async () => root.render(<ListingMedia key="oversized" src="/landscape.mp4" alt="Oversized video" player />));
    video = query<HTMLVideoElement>("video");
    Object.defineProperty(video, "getBoundingClientRect", { value: () => ({ width: 400, height: 1200 }) });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 300 });
    const beforeResize = observerFor(video);
    await act(async () => window.dispatchEvent(new window.Event("resize")));
    assert(beforeResize.disconnected);
    assert.deepEqual(observerFor(video).options?.threshold, [0, 0.125]);
    await intersect(video, 0.12); assert(video.paused);
    await intersect(video, 0.125); assert.equal(video.paused, false, "oversized players start when half the available viewport is filled");
    await act(async () => beforeResize.emit(video, 0));
    assert.equal(video.paused, false, "a stale observer cannot override the resized visibility policy");
    await intersect(video, 0); assert(video.paused);
    console.log("PASS: oversized/landscape-player thresholds adapt on resize; stale observer callbacks are ignored");

    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined });
    await act(async () => root.render(<ListingMedia src="/manual.mp4" alt="Manual fallback" player />));
    video = query<HTMLVideoElement>("video");
    assert(video.controls); assert.equal(state(video).plays, 0);
    await act(async () => { await video.play(); }); assert.equal(video.paused, false);
    await act(async () => root.unmount()); assert(video.paused);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(errors, [], "no unhandled playback/React errors");
    console.log("PASS: manual-control fallback without IntersectionObserver; no unhandled playback errors");
  } finally {
    await act(async () => root.unmount());
    process.removeListener("unhandledRejection", onRejection);
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
