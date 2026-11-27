"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * Polls a fetcher function at a fixed interval and returns the latest data.
 *
 * - Fetches immediately on mount
 * - Refetches every `intervalMs` milliseconds
 * * Pauses when the browser tab is hidden (saves battery/bandwidth)
 * - Resumes when the tab becomes visible again
 *
 * @param fetcher - Async function that returns fresh data
 * @param intervalMs - Poll interval in milliseconds (default 500)
 * @param initialData - Initial data shown before first fetch completes
 */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs = 500,
  initialData: T
) {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep fetcher ref in sync
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  useEffect(() => {
    // Immediate fetch on mount
    fetchData();

    // Start polling interval
    intervalRef.current = setInterval(fetchData, intervalMs);

    // Pause polling when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchData, intervalMs);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData, intervalMs]);

  return { data, error, refetch: fetchData };
}
