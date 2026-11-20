"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { installSiteMotion } from "@/lib/site-motion";

/** Enhance after the initial paint; server-rendered content never waits for us. */
export function SiteMotion() {
  const pathname = usePathname();
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dispose: (() => void) | undefined, stopped = false;
    const start = () => { if (!stopped) dispose = installSiteMotion(progress.current); };
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(start, { timeout: 800 }) : undefined;
    const frame = idle === undefined ? window.requestAnimationFrame(start) : undefined;
    return () => {
      stopped = true;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      dispose?.();
    };
  }, [pathname]);
  return <div ref={progress} className="ivh-scroll-progress" aria-hidden="true" />;
}
