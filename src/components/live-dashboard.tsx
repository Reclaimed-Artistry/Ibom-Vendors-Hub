"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh server-rendered badges, notification lists and subscription access. */
export function LiveDashboard() {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    let pending = false;
    let fingerprint: string | undefined;
    const controller = new AbortController();

    async function check() {
      if (stopped || pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/live", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          stopped = true;
          router.refresh();
          return;
        }
        if (!response.ok) return;
        const next = JSON.stringify(await response.json());
        if (!stopped && next !== fingerprint) {
          fingerprint = next;
          // Also refresh on mount to cover changes between SSR and hydration.
          router.refresh();
        }
      } catch {
        // Temporary network failures are retried on the next interval.
      } finally {
        pending = false;
      }
    }

    void check();
    const interval = window.setInterval(() => void check(), 5000);
    const resume = () => void check();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [router]);

  return null;
}
