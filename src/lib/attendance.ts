/**
 * Server-side mock-location heuristics.
 * Compares the latest pings to detect:
 *  - impossible speed (>MOCK_LOCATION_SPEED_KMH between consecutive pings)
 *  - accuracy outliers
 *  - large teleports
 */
import { haversineDistanceMeters, impliedSpeedKmH } from "./geo";
import { env } from "./env";

export type PingLike = {
  lat: number;
  lng: number;
  accuracyMeters?: number | null;
  capturedAt: Date;
  isMockLocation?: boolean | null;
};

export type PingFlag = {
  pingIndex: number;
  reasons: string[];
};

const SUSPICIOUS_SPEED_KMH = env.MOCK_LOCATION_SPEED_KMH;
const LARGE_TELEPORT_M = 1000;
const ACCURACY_OUTLIER_M = env.MAX_PING_ACCURACY_METERS * 2;

export function flagPings(pings: PingLike[]): PingFlag[] {
  const flags: PingFlag[] = [];
  const sorted = [...pings].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const reasons: string[] = [];
    if (p.isMockLocation) reasons.push("client_flagged_mock");
    if (p.accuracyMeters != null && p.accuracyMeters > ACCURACY_OUTLIER_M) {
      reasons.push("low_accuracy");
    }
    if (i > 0) {
      const prev = sorted[i - 1];
      const dist = haversineDistanceMeters(
        { lat: prev.lat, lng: prev.lng },
        { lat: p.lat, lng: p.lng }
      );
      if (dist > LARGE_TELEPORT_M) reasons.push("large_teleport");
      const speed = impliedSpeedKmH(
        { lat: prev.lat, lng: prev.lng, t: prev.capturedAt.getTime() },
        { lat: p.lat, lng: p.lng, t: p.capturedAt.getTime() }
      );
      if (speed > SUSPICIOUS_SPEED_KMH) reasons.push("impossible_speed");
    }
    if (reasons.length) flags.push({ pingIndex: i, reasons });
  }
  return flags;
}
