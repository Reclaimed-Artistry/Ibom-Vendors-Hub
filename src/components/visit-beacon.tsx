"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "ivh_visit_session";

/**
 * Pings /api/visit on mount and on every client-side navigation so visitor
 * traffic (including single-page-app transitions) is recorded for the Visitor
 * analytics panel. A session id is persisted in localStorage so repeat visits
 * from the same browser count as one visitor. Failures are swallowed —
 * tracking must never delay or break navigation.
 */
export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const sendVisit = () => {
      if (typeof window === "undefined" || !window.localStorage) return;

      let sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        try {
          localStorage.setItem(SESSION_KEY, sessionId);
        } catch {
          /* localStorage unavailable — send a one-off id */
        }
      }

      const payload = JSON.stringify({
        session_id: sessionId,
        path: window.location.pathname + window.location.search,
        referrer: document.referrer || undefined,
      });

      const send = async () => {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/visit", payload);
          return;
        }
        try {
          await fetch("/api/visit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        } catch {
          /* best effort only */
        }
      };

      void send();
    };

    sendVisit();
    // Give the router a tick to settle the pathname after hydration.
    const timer = setTimeout(sendVisit, 250);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
