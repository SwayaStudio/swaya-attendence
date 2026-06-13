/**
 * One reliable "get my current location" used by check-in / check-out.
 *
 * Strategy (both native and web):
 *   1. Try a high-accuracy GPS fix with a generous timeout, allowing a recent
 *      cached fix to be reused (maximumAge) so we don't always cold-start the GPS.
 *   2. If that fails (usually a TIMEOUT indoors), retry once with high accuracy
 *      OFF — wifi/cell positioning is much faster and is accurate enough to tell
 *      whether you're inside a site geofence.
 * On Android/iOS it uses the Capacitor Geolocation plugin (faster/more reliable
 * than the WebView's navigator.geolocation); in a browser it uses the Web API.
 */
import { isNative } from "./platform";

export type Coords = { latitude: number; longitude: number; accuracy?: number };

// High accuracy first, then a faster coarse fallback.
const FINE = { enableHighAccuracy: true, timeout: 25_000, maximumAge: 30_000 };
const COARSE = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 };

export async function getCurrentLocation(): Promise<Coords> {
  return isNative() ? getNative() : getWeb();
}

async function getNative(): Promise<Coords> {
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      const req = await Geolocation.requestPermissions();
      if (req.location !== "granted" && req.coarseLocation !== "granted") {
        throw new Error("Location permission denied. Please enable location access for the app.");
      }
    }
  } catch (e: any) {
    if (e?.message?.includes("permission")) throw e;
    // checkPermissions can throw on some setups — continue and let getPosition try.
  }

  try {
    const pos = await Geolocation.getCurrentPosition(FINE);
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch {
    try {
      const pos = await Geolocation.getCurrentPosition(COARSE);
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch {
      throw new Error("Couldn't get your location. Move to an open area and make sure GPS is on, then try again.");
    }
  }
}

function getWeb(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }
    const ok = (pos: GeolocationPosition) =>
      resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });

    navigator.geolocation.getCurrentPosition(
      ok,
      // First (high-accuracy) attempt failed — retry with coarse positioning.
      () => {
        navigator.geolocation.getCurrentPosition(ok, (err) => reject(friendlyGeoError(err)), COARSE);
      },
      FINE
    );
  });
}

function friendlyGeoError(err: GeolocationPositionError): Error {
  switch (err.code) {
    case 1:
      return new Error("Location permission denied. Please allow location access and try again.");
    case 2:
      return new Error("Couldn't determine your location. Move to an open area and try again.");
    case 3:
      return new Error("Getting your location took too long. Move to an open area (GPS is weak indoors) and try again.");
    default:
      return new Error(err.message || "Location error.");
  }
}
