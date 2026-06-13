/**
 * Security/integration tests for the native geofence-event endpoint:
 * token auth, active-employee check, ENTER->check-in / EXIT->checkout routing,
 * and Zod validation. The service + model layer is mocked.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as any }));

vi.mock("@/lib/db", () => ({ connectDB: vi.fn(async () => ({})) }));
vi.mock("@/lib/attendance-service", () => ({
  processGeofenceEnter: vi.fn(async () => ({ ok: true })),
  processGeofenceExit: vi.fn(async () => ({ ok: true, session: {}, day: {} })),
}));
vi.mock("@/models", () => ({
  User: { findOne: () => ({ select: () => ({ lean: async () => state.user }) }) },
}));

import { POST as geofence } from "@/app/api/geofence-event/route";
import { mintNativeToken } from "@/lib/native-token";
import { processGeofenceEnter, processGeofenceExit } from "@/lib/attendance-service";

const EMP = "650000000000000000000001";
const CO = "650000000000000000000099";
const validToken = mintNativeToken(EMP, CO);

const req = (body: unknown) =>
  ({ json: async () => body, headers: new Headers(), url: "http://localhost/api/geofence-event" }) as any;

const base = { lat: 12.9153, lng: 77.6428, accuracy: 30 };

beforeEach(() => {
  state.user = { _id: EMP }; // active employee found by default
  vi.clearAllMocks();
});

describe("POST /api/geofence-event", () => {
  it("401 on an invalid token", async () => {
    const res = await geofence(req({ ...base, transition: "EXIT", token: "bogus.token" }));
    expect(res.status).toBe(401);
    expect(processGeofenceExit).not.toHaveBeenCalled();
  });

  it("403 when the employee is inactive / not found", async () => {
    state.user = null;
    const res = await geofence(req({ ...base, transition: "EXIT", token: validToken }));
    expect(res.status).toBe(403);
  });

  it("routes EXIT to processGeofenceExit with the token's identity", async () => {
    const res = await geofence(req({ ...base, transition: "EXIT", token: validToken }));
    expect(res.status).toBe(200);
    expect(processGeofenceExit).toHaveBeenCalledTimes(1);
    const arg = (processGeofenceExit as any).mock.calls[0][0];
    expect(arg.employeeId).toBe(EMP);
    expect(arg.companyId).toBe(CO);
  });

  it("routes ENTER to processGeofenceEnter", async () => {
    const res = await geofence(req({ ...base, transition: "ENTER", token: validToken }));
    expect(res.status).toBe(200);
    expect(processGeofenceEnter).toHaveBeenCalledTimes(1);
    expect(processGeofenceExit).not.toHaveBeenCalled();
  });

  it("400 on a bad transition value (Zod)", async () => {
    const res = await geofence(req({ ...base, transition: "SIDEWAYS", token: validToken }));
    expect(res.status).toBe(400);
  });

  it("400 on out-of-range coordinates", async () => {
    const res = await geofence(req({ lat: 999, lng: 0, transition: "EXIT", token: validToken }));
    expect(res.status).toBe(400);
  });

  it("uses the body identity, never trusting any extra body fields", async () => {
    await geofence(req({ ...base, transition: "EXIT", token: validToken, employeeId: "FORGED" }));
    const arg = (processGeofenceExit as any).mock.calls[0][0];
    expect(arg.employeeId).toBe(EMP); // from the signed token, not the body
  });
});
