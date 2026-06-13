/**
 * Offline check-in / check-out queue (localStorage).
 *
 * When the network is down, a check-in/out is validated client-side (geofence)
 * and stored here with the REAL time it happened (`capturedAt`). When the device
 * is back online, replayQueue() POSTs each one to the server, which records it at
 * its captured time. Server-side 4xx rejections (e.g. outside geofence at that
 * time, or no active session) drop the item; network/5xx errors keep it to retry.
 */
export type QueuedAction = {
  id: string;
  type: "check-in" | "check-out";
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt: string; // ISO
  deviceId: string;
};

const KEY = "geo-attendance-offline-queue";

function read(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: QueuedAction[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full / unavailable */
  }
}

export function getQueue(): QueuedAction[] {
  return read().sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export function enqueueAction(a: Omit<QueuedAction, "id">): QueuedAction {
  const item: QueuedAction = {
    ...a,
    id: `${a.type}-${a.capturedAt}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const items = read();
  items.push(item);
  write(items);
  return item;
}

function removeAction(id: string) {
  write(read().filter((i) => i.id !== id));
}

/** Replay queued actions oldest-first. Returns how many synced successfully. */
export async function replayQueue(): Promise<number> {
  const items = getQueue();
  let synced = 0;
  for (const item of items) {
    const url = item.type === "check-in" ? "/api/attendance/check-in" : "/api/attendance/check-out";
    const body =
      item.type === "check-in"
        ? {
            lat: item.lat,
            lng: item.lng,
            accuracy: item.accuracy,
            isMockLocation: false,
            deviceId: item.deviceId,
            capturedAt: item.capturedAt,
          }
        : { lat: item.lat, lng: item.lng, accuracy: item.accuracy, capturedAt: item.capturedAt };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        removeAction(item.id);
        synced++;
      } else if (res.status >= 400 && res.status < 500) {
        // Server rejected it (outside geofence / no active session / etc.) — drop
        // it so it doesn't retry forever.
        removeAction(item.id);
      }
      // 5xx: leave it queued and try again next time.
    } catch {
      // Network still down — stop; we'll retry on the next "online" event.
      break;
    }
  }
  return synced;
}
