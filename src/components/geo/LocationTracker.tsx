"use client";

import { useEffect } from "react";
import { useBackgroundTracker } from "@/hooks/useBackgroundTracker";

export function LocationTracker({
  active,
  onAutoCheckout,
}: {
  active: boolean;
  onAutoCheckout?: () => void;
}) {
  const { lastPing, queueSize, running } = useBackgroundTracker({
    active,
    intervalMs: 60_000,
    onError: () => {},
    onAutoCheckout,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore — falls back to foreground only
    });
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "pings-flushed") {
        // could update UI
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  return null; // headless component
}