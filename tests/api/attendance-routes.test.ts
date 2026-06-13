/**
 * API security/integration tests for the employee attendance endpoints.
 * The real route handlers run; only the auth boundary, DB connect, the Company
 * lookup, and the attendance-service are mocked, so every security control
 * (auth, role, Zod validation, forged-id rejection, response shape, cache
 * headers, oversized/NoSQL payloads) is exercised deterministically — no DB.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- shared mutable session, controlled per-test -------------------------
const h = vi.hoisted(() => ({ session: null as any }));

vi.mock("@/lib/db", () => ({ connectDB: vi.fn(async () => ({})) }));

vi.mock("@/lib/api-helpers", async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    requireAuth: async () => {
      if (!h.session) throw new actual.ApiError("Unauthenticated", 401);
      return h.session;
    },
    requireRole: async (allowed: string[]) => {
      if (!h.session) throw new actual.ApiError("Unauthenticated", 401);
      if (!allowed.includes(h.session.user.role)) {
        throw new actual.ApiError("Forbidden", 403);
      }
      return h.session;
    },
  };
});

vi.mock("@/models", () => ({
  Company: { findById: () => ({ lean: async () => ({ timezone: "Asia/Kolkata" }) }) },
}));

vi.mock("@/lib/attendance-service", () => ({
  processCheckIn: vi.fn(async () => ({ ok: true, attendanceDay: {}, session: {}, site: {} })),
  processCheckOut: vi.fn(async () => ({ ok: true, session: {}, day: {} })),
  processPings: vi.fn(async () => ({ ok: true, received: 1, autoCheckedOut: false, autoCheckoutAt: null })),
}));

import { POST as checkIn } from "@/app/api/attendance/check-in/route";
import { POST as checkOut } from "@/app/api/attendance/check-out/route";
import { POST as pings } from "@/app/api/pings/route";
import { processCheckIn, processCheckOut, processPings } from "@/lib/attendance-service";

const SESSION_EMP = {
  user: { id: "650000000000000000000001", companyId: "650000000000000000000099", role: "employee" },
};
const SESSION_ADMIN = {
  user: { id: "650000000000000000000002", companyId: "650000000000000000000099", role: "admin" },
};

const req = (body: unknown, url = "http://localhost/api/x") =>
  ({ json: async () => body, headers: new Headers(), url }) as any;

const validCheckIn = {
  lat: 12.9153,
  lng: 77.6428,
  accuracy: 5,
  deviceId: "dev-1",
};

beforeEach(() => {
  h.session = null;
  vi.clearAllMocks();
});

describe("POST /api/attendance/check-in", () => {
  it("401 when unauthenticated", async () => {
    const res = await checkIn(req(validCheckIn));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("403 when a non-employee (admin) checks in", async () => {
    h.session = SESSION_ADMIN;
    const res = await checkIn(req(validCheckIn));
    expect(res.status).toBe(403);
    expect(processCheckIn).not.toHaveBeenCalled();
  });

  it("200 + uniform shape for a valid employee check-in", async () => {
    h.session = SESSION_EMP;
    const res = await checkIn(req(validCheckIn));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("IGNORES a forged employeeId/companyId in the body (uses the session identity)", async () => {
    h.session = SESSION_EMP;
    await checkIn(
      req({ ...validCheckIn, employeeId: "FORGED", companyId: "FORGEDCO" })
    );
    expect(processCheckIn).toHaveBeenCalledTimes(1);
    const arg = (processCheckIn as any).mock.calls[0][0];
    expect(arg.employeeId).toBe(SESSION_EMP.user.id);
    expect(arg.companyId).toBe(SESSION_EMP.user.companyId);
  });

  it("400 on Zod validation failure (out-of-range latitude)", async () => {
    h.session = SESSION_EMP;
    const res = await checkIn(req({ ...validCheckIn, lat: 999 }));
    expect(res.status).toBe(400);
    expect(processCheckIn).not.toHaveBeenCalled();
  });

  it("400 on a NoSQL-injection-style operator payload (lat as {$gt})", async () => {
    h.session = SESSION_EMP;
    const res = await checkIn(req({ ...validCheckIn, lat: { $gt: 0 } }));
    expect(res.status).toBe(400);
    expect(processCheckIn).not.toHaveBeenCalled();
  });

  it("400 when required deviceId is missing", async () => {
    h.session = SESSION_EMP;
    const { deviceId, ...noDevice } = validCheckIn;
    const res = await checkIn(req(noDevice));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/attendance/check-out", () => {
  it("401 when unauthenticated", async () => {
    expect((await checkOut(req({ lat: 12.9, lng: 77.6 }))).status).toBe(401);
  });
  it("403 for a non-employee", async () => {
    h.session = SESSION_ADMIN;
    expect((await checkOut(req({ lat: 12.9, lng: 77.6 }))).status).toBe(403);
  });
  it("uses the session identity, not the body", async () => {
    h.session = SESSION_EMP;
    await checkOut(req({ lat: 12.9, lng: 77.6, employeeId: "FORGED" }));
    const arg = (processCheckOut as any).mock.calls[0][0];
    expect(arg.employeeId).toBe(SESSION_EMP.user.id);
    expect(arg.companyId).toBe(SESSION_EMP.user.companyId);
  });
});

describe("POST /api/pings", () => {
  it("401 when unauthenticated", async () => {
    expect((await pings(req({ pings: [validCheckIn] }))).status).toBe(401);
  });

  it("403 for a non-employee", async () => {
    h.session = SESSION_ADMIN;
    expect((await pings(req({ pings: [validCheckIn] }))).status).toBe(403);
  });

  it("400 when the batch is empty", async () => {
    h.session = SESSION_EMP;
    expect((await pings(req({ pings: [] }))).status).toBe(400);
  });

  it("400 on an OVERSIZED ping batch (>500)", async () => {
    h.session = SESSION_EMP;
    const big = { pings: Array.from({ length: 501 }, () => validCheckIn) };
    const res = await pings(req(big));
    expect(res.status).toBe(400);
    expect(processPings).not.toHaveBeenCalled();
  });

  it("forwards the session identity for a valid batch", async () => {
    h.session = SESSION_EMP;
    await pings(req({ pings: [validCheckIn] }));
    const arg = (processPings as any).mock.calls[0][0];
    expect(arg.employeeId).toBe(SESSION_EMP.user.id);
    expect(arg.companyId).toBe(SESSION_EMP.user.companyId);
  });
});
