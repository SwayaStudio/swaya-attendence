/**
 * Native OS-geofence fallback (Android only). While the app is OPEN, the precise
 * ping system is the primary tracker. This registers a wider (~100m) OS geofence
 * so that AFTER the app is killed, Android still fires ENTER/EXIT to the native
 * receiver, which POSTs to /api/geofence-event (see GeofenceBroadcastReceiver).
 *
 * No-op on web/iOS. Best-effort: failures never block the app.
 */
import { registerPlugin, Capacitor } from "@capacitor/core";

interface GeofenceTrackerPlugin {
  addGeofence(opts: { lat: number; lng: number; radius: number }): Promise<void>;
  removeGeofence(): Promise<void>;
}

const GeofenceTracker = registerPlugin<GeofenceTrackerPlugin>("GeofenceTracker");

const KEYS = {
  token: "geofence_token",
  url: "geofence_url",
  lat: "geofence_lat",
  lng: "geofence_lng",
  radius: "geofence_radius",
};

// The OS geofencing engine is unreliable below ~100m, so the killed-app ring is
// never smaller than this. For sites already >= 100m we use the REAL radius, so a
// 200m site is watched at 200m (no compromise) and only tiny sites get widened.
const MIN_RELIABLE_RADIUS_METERS = 100;

async function prefsSet(key: string, value: string) {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}
async function prefsRemove(key: string) {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key });
}

/**
 * Register the killed-app geofence around `site` and store the native upload
 * token + config for the receiver and the boot re-registration.
 */
export async function enableGeofenceFallback(site: {
  lat: number;
  lng: number;
  radiusMeters?: number;
}): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    const res = await fetch("/api/auth/native-token");
    const json = await res.json().catch(() => null);
    const token: string | undefined = json?.data?.token;
    if (!token) return;

    // Use the site's real radius, but never below the OS reliability floor.
    const radius = Math.max(site.radiusMeters || 0, MIN_RELIABLE_RADIUS_METERS);
    const baseUrl = window.location.origin;
    await Promise.all([
      prefsSet(KEYS.token, token),
      prefsSet(KEYS.url, baseUrl),
      prefsSet(KEYS.lat, String(site.lat)),
      prefsSet(KEYS.lng, String(site.lng)),
      prefsSet(KEYS.radius, String(radius)),
    ]);
    await GeofenceTracker.addGeofence({ lat: site.lat, lng: site.lng, radius });
  } catch {
    /* best-effort — native plugin/permission may be unavailable */
  }
}

/** Remove the geofence and clear the stored token (called on check-out). */
export async function disableGeofenceFallback(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await GeofenceTracker.removeGeofence();
  } catch {
    /* ignore */
  }
  await Promise.all([prefsRemove(KEYS.token), prefsRemove(KEYS.url)]).catch(() => {});
}
