/**
 * Geo helpers — pure functions, used by both client and server.
 */
const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export function isInsideGeofence(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusMeters: number,
  accuracyMeters = 0
): { inside: boolean; distance: number } {
  const distance = haversineDistanceMeters(point, center);
  // generous allowance: GPS accuracy can offset the user's reported position
  const threshold = radiusMeters + Math.max(0, accuracyMeters);
  return { inside: distance <= threshold, distance };
}

export function impliedSpeedKmH(
  from: { lat: number; lng: number; t: number },
  to: { lat: number; lng: number; t: number }
): number {
  const dtSec = Math.max(1, (to.t - from.t) / 1000);
  const distM = haversineDistanceMeters(from, to);
  return (distM / dtSec) * 3.6; // m/s -> km/h
}
