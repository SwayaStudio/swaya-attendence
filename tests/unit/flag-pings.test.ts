import { describe, it, expect } from "vitest";
import { flagPings, type PingLike } from "@/lib/attendance";

const base = (over: Partial<PingLike> & { t: number }): PingLike => ({
  lat: 12.9153,
  lng: 77.6428,
  accuracyMeters: 10,
  isMockLocation: false,
  capturedAt: new Date(over.t),
  ...over,
});

describe("flagPings (mock-location heuristics)", () => {
  it("returns no flags for a still, accurate sequence", () => {
    const pings = [base({ t: 0 }), base({ t: 60_000 }), base({ t: 120_000 })];
    expect(flagPings(pings)).toEqual([]);
  });

  it("flags a client-reported mock location", () => {
    const pings = [base({ t: 0 }), base({ t: 60_000, isMockLocation: true })];
    const flags = flagPings(pings);
    expect(flags.some((f) => f.reasons.includes("client_flagged_mock"))).toBe(
      true
    );
  });

  it("flags low accuracy beyond the outlier threshold (>200m)", () => {
    const pings = [base({ t: 0, accuracyMeters: 500 })];
    const flags = flagPings(pings);
    expect(flags[0].reasons).toContain("low_accuracy");
  });

  it("flags an impossible speed between consecutive pings", () => {
    // ~111km jump in 1s -> impossible.
    const pings = [
      base({ t: 0 }),
      base({ t: 1000, lat: 13.9153, lng: 77.6428 }),
    ];
    const flags = flagPings(pings);
    const reasons = flags.flatMap((f) => f.reasons);
    expect(reasons).toContain("impossible_speed");
    expect(reasons).toContain("large_teleport");
  });

  it("sorts unsorted input by capturedAt before comparing", () => {
    // Provided out of order; the big jump is still between adjacent-in-time pings.
    const pings = [
      base({ t: 1000, lat: 13.9153 }),
      base({ t: 0 }),
    ];
    const flags = flagPings(pings);
    expect(flags.flatMap((f) => f.reasons)).toContain("impossible_speed");
  });

  it("does not flag a normal walk (a few meters over a minute)", () => {
    const pings = [
      base({ t: 0 }),
      base({ t: 60_000, lat: 12.9154 }), // ~11m in 60s
    ];
    expect(flagPings(pings)).toEqual([]);
  });
});
