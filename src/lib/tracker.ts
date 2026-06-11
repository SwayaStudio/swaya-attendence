/**
 * Cross-platform tracker — native background-geolocation on Android/iOS,
 * web setInterval on regular browsers.
 *
 * The web tracker's behavior mirrors useBackgroundTracker (see
 * src/hooks/useBackgroundTracker.ts); the native version delegates to
 * @capacitor-community/background-geolocation, which keeps a foreground
 * service alive so pings keep arriving even when the app is closed.
 *
 * Both paths POST to the same /api/pings endpoint with the same payload,
 * so the server-side processPings() doesn't need to know which one fired.
 */
import { isNative, getPlatform } from './platform';

type PingPayload = {
  lat: number;
  lng: number;
  accuracy?: number;
  isMockLocation?: boolean;
  batteryPercentage?: number;
  networkType?: 'wifi' | 'mobile_data' | 'offline' | 'unknown';
  appState?: 'foreground' | 'background' | 'killed' | 'unknown';
  deviceId: string;
  appVersion?: string;
  capturedAt: string;
};

const DEFAULT_DEVICE_ID = 'web';
const APP_VERSION = '1.0.0';

let nativeWatcherId: string | null = null;
let webInterval: ReturnType<typeof setInterval> | null = null;
let webFirstTick: ReturnType<typeof setTimeout> | null = null;

/**
 * Start tracking. Idempotent — calling twice is a no-op.
 */
export async function startTracker(opts: {
  active: boolean;
  deviceId?: string;
  intervalMs?: number;
  onError?: (e: Error) => void;
} = { active: true }) {
  if (!opts.active) return;
  const deviceId = opts.deviceId ?? DEFAULT_DEVICE_ID;
  const intervalMs = opts.intervalMs ?? 15_000;

  if (isNative()) {
    return startNative({ deviceId, onError: opts.onError });
  }
  return startWeb({ deviceId, intervalMs });
}

export async function stopTracker() {
  if (isNative()) {
    if (nativeWatcherId) {
      try {
        const mod = await loadBackgroundGeolocation();
        await mod.BackgroundGeolocation.removeWatcher({ id: nativeWatcherId });
      } catch {
        // ignore
      }
      nativeWatcherId = null;
    }
    return;
  }
  if (webInterval) {
    clearInterval(webInterval);
    webInterval = null;
  }
  if (webFirstTick) {
    clearTimeout(webFirstTick);
    webFirstTick = null;
  }
}

// ─── Native (Android/iOS) ───────────────────────────────────────────────

async function startNative(opts: {
  deviceId: string;
  onError?: (e: Error) => void;
}) {
  if (nativeWatcherId) return;
  try {
    const { BackgroundGeolocation } = await loadBackgroundGeolocation();
    // The plugin uses a Watcher API; we get a callback per location and
    // POST it ourselves to /api/pings (same payload shape as the web path).
    const id = await BackgroundGeolocation.addWatcher(
      {
        // backgroundMessage makes the watcher survive the app being
        // backgrounded. On Android it pins a persistent notification.
        backgroundMessage: 'Swaya Attendance is tracking your location',
        backgroundTitle: 'Swaya Attendance',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10,
      },
      async (location: { latitude: number; longitude: number; accuracy: number; simulated: boolean; time: number }, error: { code: string; message?: string } | undefined) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            opts.onError?.(new Error('Location permission denied'));
            try {
              await BackgroundGeolocation.openSettings();
            } catch {
              // ignore
            }
          } else {
            opts.onError?.(new Error(error.message || 'Geolocation error'));
          }
          return;
        }
        await postPing({
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy,
          isMockLocation: location.simulated,
          batteryPercentage: await getBatteryPercent(),
          networkType: getNetworkType(),
          appState: 'background',
          deviceId: opts.deviceId,
          appVersion: APP_VERSION,
          capturedAt: new Date(location.time).toISOString(),
        });
      }
    );
    nativeWatcherId = id;
  } catch (e) {
    nativeWatcherId = null;
    opts.onError?.(e as Error);
  }
}

async function loadBackgroundGeolocation() {
  // The plugin's main export is named; some bundlers expose it under .default.
  const mod: any = await import('@capacitor-community/background-geolocation');
  const BackgroundGeolocation =
    mod.BackgroundGeolocation ?? mod.default?.BackgroundGeolocation;
  if (!BackgroundGeolocation) {
    throw new Error('BackgroundGeolocation plugin not available');
  }
  return { BackgroundGeolocation };
}

function getNetworkType(): PingPayload['networkType'] {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn: any = (navigator as any).connection;
  if (!conn) return navigator.onLine ? 'mobile_data' : 'offline';
  if (conn.type === 'wifi') return 'wifi';
  if (conn.type === 'cellular') return 'mobile_data';
  if (conn.type === 'none') return 'offline';
  return navigator.onLine ? 'mobile_data' : 'offline';
}

async function postPing(payload: PingPayload) {
  try {
    const res = await fetch('/api/pings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pings: [payload] }),
    });
    if (!res.ok) {
      // Native fallback: queue via service worker if registered
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.active?.postMessage({ type: 'enqueue-ping', ping: payload });
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // network down — leave the ping in the SW queue
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'enqueue-ping', ping: payload });
      } catch {
        // ignore
      }
    }
  }
}

// ─── Web (setInterval, with SW fallback) ────────────────────────────────

async function startWeb(opts: { deviceId: string; intervalMs: number }) {
  if (webInterval) return;

  const swReady =
    'serviceWorker' in navigator
      ? navigator.serviceWorker.ready
      : Promise.reject(new Error('no sw'));

  async function sendPing(coords: { lat: number; lng: number; accuracy?: number }) {
    const capturedAt = new Date().toISOString();
    const battery = await getBatteryPercent();
    const network: PingPayload['networkType'] = navigator.onLine ? 'mobile_data' : 'offline';
    const payload: PingPayload = {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      isMockLocation: false,
      batteryPercentage: battery,
      networkType: network,
      appState:
        document.visibilityState === 'visible'
          ? 'foreground'
          : 'background',
      deviceId: opts.deviceId,
      appVersion: APP_VERSION,
      capturedAt,
    };

    try {
      const res = await fetch('/api/pings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pings: [payload] }),
      });
      if (!res.ok) throw new Error('ping failed: ' + res.status);
    } catch {
      try {
        const reg = await swReady;
        reg.active?.postMessage({ type: 'enqueue-ping', ping: payload });
      } catch {
        // last resort: drop the ping
      }
    }
  }

  function tick() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void sendPing({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        // permission denied or no fix — silent
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 1000 }
    );
  }

  webInterval = setInterval(tick, opts.intervalMs);
  webFirstTick = setTimeout(tick, 1500);
}

async function getBatteryPercent(): Promise<number | undefined> {
  try {
    const b: any = await (navigator as any).getBattery?.();
    if (b) return Math.round(b.level * 100);
  } catch {
    // ignore
  }
  return undefined;
}

// Re-export for callers that want to know which platform the tracker chose
export { getPlatform };
