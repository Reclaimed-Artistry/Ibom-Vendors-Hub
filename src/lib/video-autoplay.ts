/** Browser-only viewport playback. Call from an effect and always run its cleanup. */
export function observeVideoAutoplay(video: HTMLVideoElement): () => void {
  const document = video.ownerDocument;
  const window = document.defaultView;
  if (!window?.IntersectionObserver) return () => video.pause();

  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let visible = false;
  let disposed = false;
  let manuallyPaused = false;
  let internalPauses = 0;

  const eligible = () => visible && !disposed && !document.hidden && !motion?.matches && !manuallyPaused;
  const pause = () => {
    if (!video.paused) {
      internalPauses += 1;
      video.pause();
    }
  };
  const update = () => {
    if (!eligible()) { pause(); return; }
    // Muted, inline playback is permitted on mobile without a prior gesture.
    // Do not force sound back on when scrolling or returning to a background tab.
    video.muted = true;
    try {
      void video.play()?.then(() => {
        // Scrolling/unmounting can race a pending play() promise.
        if (!eligible()) pause();
      }).catch(() => {
        // Low-power modes/browser policies/codecs can reject autoplay. Keep
        // native controls and the open-file fallback usable; never reject globally.
      });
    } catch {
      // Older browsers may throw synchronously instead of returning a rejection.
    }
  };
  const onPause = () => {
    if (internalPauses) { internalPauses -= 1; return; }
    if (visible && !document.hidden && !video.ended) manuallyPaused = true;
  };
  const onPlay = () => { manuallyPaused = false; };
  let observer: IntersectionObserver | undefined;
  let observation = 0;
  const observe = () => {
    if (disposed) return;
    observer?.disconnect();
    const current = ++observation;
    const { width, height } = video.getBoundingClientRect();
    // A tall player may never be 50% visible on a landscape phone. Require
    // half the area that can actually fit in this viewport instead.
    const availableArea = Math.min(width, window.innerWidth) * Math.min(height, window.innerHeight);
    const threshold = width > 0 && height > 0 ? Math.min(0.5, availableArea / (width * height) / 2) : 0.5;
    observer = new window.IntersectionObserver(entries => {
      if (disposed || current !== observation) return;
      for (const entry of entries) {
        if (entry.target !== video) continue;
        const next = entry.isIntersecting && entry.intersectionRatio > 0 && entry.intersectionRatio >= threshold;
        if (next === visible) continue;
        visible = next;
        update();
      }
    }, { threshold: [0, threshold] });
    observer.observe(video);
  };
  const resize = window.ResizeObserver ? new window.ResizeObserver(observe) : null;

  video.addEventListener("pause", onPause);
  video.addEventListener("play", onPlay);
  document.addEventListener("visibilitychange", update);
  motion?.addEventListener("change", update);
  window.addEventListener("resize", observe);
  resize?.observe(video);
  observe();

  return () => {
    disposed = true;
    observer?.disconnect();
    resize?.disconnect();
    window.removeEventListener("resize", observe);
    document.removeEventListener("visibilitychange", update);
    motion?.removeEventListener("change", update);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("play", onPlay);
    pause();
  };
}
