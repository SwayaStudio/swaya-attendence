import { describe, it, expect } from "vitest";
import {
  haversineDistanceMeters,
  isInsideGeofence,
  impliedSpeedKmH,
} from "@/lib/geo";

describe("haversineDistanceMeters", () => {
  it("is zero for identical points", () => {
    const p = { lat: 12.9153, lng: 77.6428 };
    expect(haversineDistanceMeters(p, p)).toBe(0);
  });

  it("is symmetric", () => {
    const a = { lat: 12.9153, lng: 77.6428 };
    const b = { lat: 12.9155, lng: 77.6415 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(
      haversineDistanceMeters(b, a),
      6
    );
  });

  it("matches a known distance (~111.2m per 0.001 deg latitude)", () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0.001, lng: 0 };
    // 1 degree latitude ~= 111.19 km, so 0.001 deg ~= 111.2 m
    expect(haversineDistanceMeters(a, b)).toBeGreaterThan(110);
    expect(haversineDistanceMeters(a, b)).toBeLessThan(112);
  });

  it("computes the real-world example from the field report (~160m)", () => {
    // Site vs. the coordinate the employee walked to (from the bug report).
    const site = { lat: 12.915356916409525, lng: 77.64286120026878 };
    const away = { lat: 12.915525, lng: 77.641539 };
    const d = haversineDistanceMeters(site, away);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(170);
  });
});

describe("isInsideGeofence", () => {
  const center = { lat: 12.915356916409525, lng: 77.64286120026878 };

  it("treats the exact center as inside", () => {
    const { inside, distance } = isInsideGeofence(center, center, 20);
    expect(inside).toBe(true);
    expect(distance).toBe(0);
  });

  it("is inside exactly at the radius boundary", () => {
    // 0.0001 deg latitude ~= 11.1m, well inside a 20m radius.
    const point = { lat: center.lat + 0.0001, lng: center.lng };
    expect(isInsideGeofence(point, center, 20).inside).toBe(true);
  });

  it("is outside a 20m radius at ~160m away", () => {
    const away = { lat: 12.915525, lng: 77.641539 };
    expect(isInsideGeofence(away, center, 20).inside).toBe(false);
  });

  it("expands the threshold by GPS accuracy", () => {
    // A point ~111m north of center: outside a 20m radius alone...
    const point = { lat: center.lat + 0.001, lng: center.lng };
    expect(isInsideGeofence(point, center, 20, 0).inside).toBe(false);
    // ...but inside once a generous 200m accuracy is allowed.
    expect(isInsideGeofence(point, center, 20, 200).inside).toBe(true);
  });

  it("never lets negative accuracy shrink the threshold", () => {
    const point = { lat: center.lat + 0.0003, lng: center.lng }; // ~33m
    // negative accuracy must be clamped to 0, not subtracted.
    expect(isInsideGeofence(point, center, 20, -1000).inside).toBe(false);
  });
});

describe("impliedSpeedKmH", () => {
  it("returns 0 for no movement", () => {
    const p = { lat: 12.9, lng: 77.6, t: 0 };
    expect(impliedSpeedKmH(p, { ...p, t: 10_000 })).toBe(0);
  });

  it("flags impossible speed (teleport in 1s)", () => {
    const from = { lat: 12.9, lng: 77.6, t: 0 };
    const to = { lat: 13.9, lng: 77.6, t: 1000 }; // ~111km in 1s
    expect(impliedSpeedKmH(from, to)).toBeGreaterThan(200);
  });

  it("clamps tiny/zero time deltas to >=1s to avoid Infinity", () => {
    const from = { lat: 12.9, lng: 77.6, t: 1000 };
    const to = { lat: 12.91, lng: 77.6, t: 1000 }; // same timestamp
    const v = impliedSpeedKmH(from, to);
    expect(Number.isFinite(v)).toBe(true);
  });
});
