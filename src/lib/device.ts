/**
 * A stable per-device id for this browser / WebView, persisted in localStorage.
 * Uses Web Crypto (never the Node `crypto` module, which fails to bundle on the
 * client). Shared by check-in and the background tracker so pings and sessions
 * report the same device.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "web";
  try {
    const KEY = "geo-attendance-device-id";
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      const rand =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10);
      id = "web-" + rand;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "web-" + Math.random().toString(36).slice(2, 10);
  }
}
