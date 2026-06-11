"use client";

import { useEffect, useRef, useState } from "react";

type PingPayload = {
  lat: number;
  lng: number;
  accuracy?: number;
  isMockLocation?: boolean;
  batteryPercentage?: number;
  networkType?: "wifi" | "mobile_data" | "offline" | "unknown";
  appState?: "foreground" | "background" | "killed" | "unknown";
  deviceId: string;
  appVersion?: string;
  capturedAt?: string;
};

const DEFAULT_DEVICE_ID = "web";

export function useBackgroundTracker(opts: {
  active: boolean;
  intervalMs?: number;
  deviceId?: string;
  onError?: (e: Error) => void;
}) {
  const { active, intervalMs = 60_000, deviceId = DEFAULT_DEVICE_ID, onError } = opts;
  const [lastPing, setLastPing] = useState<{ lat: number; lng: number; t: number } | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [running, setRunning] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    setRunning(true);
    const swReady = "serviceWorker" in navigator
      ? navigator.serviceWorker.ready
      : Promise.reject(new Error("no sw"));

    async function sendPing(coords: { lat: number; lng: number; accuracy?: number }) {
      const capturedAt = new Date().toISOString();
      const battery = await getBatteryPercent();
      const network: PingPayload["networkType"] = navigator.onLine ? "mobile_data" : "offline";
      const payload: PingPayload = {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        isMockLocation: false,
        batteryPercentage: battery,
        networkType: network,
        appState: document.visibilityState === "visible" ? "foreground" : "background",
        deviceId,
        appVersion: "1.0.0",
        capturedAt,
      };

      // Try direct fetch first; if it fails, queue via service worker.
      try {
        const res = await fetch("/api/pings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pings: [payload] }),
        });
        if (!res.ok) throw new Error("ping failed: " + res.status);
        setLastPing({ lat: coords.lat, lng: coords.lng, t: Date.now() });
      } catch (e) {
        // queue via service worker
        try {
          const reg = await swReady;
          reg.active?.postMessage({ type: "enqueue-ping", ping: payload });
          setQueueSize((q) => q + 1);
        } catch (err) {
          onError?.(err as Error);
        }
      }
    }

    function tick() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void sendPing({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => onError?.(err as Error),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 1000 }
      );
    }

    // Periodic
    intervalRef.current = setInterval(tick, intervalMs);
    // First tick soon
    const firstTick = setTimeout(tick, 1500);

    return () => {
      clearTimeout(firstTick);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      setRunning(false);
    };
  }, [active, intervalMs, deviceId, onError]);

  return { lastPing, queueSize, running };
}

async function getBatteryPercent(): Promise<number | undefined> {
  try {
    const b: any = await (navigator as any).getBattery?.();
    if (b) return Math.round(b.level * 100);
  } catch {}
  return undefined;
}
