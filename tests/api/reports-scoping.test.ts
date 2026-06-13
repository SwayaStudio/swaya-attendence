/**
 * Company-scoping, role-scoping, invalid-id handling and CSV-injection safety for
 * the reports endpoint. The model layer is mocked to capture the Mongo filter so
 * we can prove every query is constrained to the caller's company.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";

const state = vi.hoisted(() => ({
  capturedDayFilter: null as any,
  days: [] as any[],
  users: [] as any[],
  counts: [] as any[],
}));
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
  };
});
vi.mock("@/models", () => {
  const chain = (resolve: () => any): any => {
    const c: any = {
      sort: () => c,
      limit: () => c,
      select: () => c,
      lean: async () => resolve(),
    };
    return c;
  };
  return {
    AttendanceDay: {
      find: vi.fn((f: any) => {
        state.capturedDayFilter = f;
        return chain(() => state.days);
      }),
    },
    User: { find: vi.fn(() => chain(() => state.users)) },
    AttendanceSession: { aggregate: vi.fn(async () => state.counts) },
  };
});

import { GET as reports } from "@/app/api/reports/attendance/route";

const COMPANY = "650000000000000000000099";
const EMP_ID = "650000000000000000000001";
const OTHER_EMP = "650000000000000000000123";

const session = (role: string, id = EMP_ID) => ({ user: { id, companyId: COMPANY, role } });
const req = (query = "") =>
  ({ url: `http://localhost/api/reports/attendance${query}`, headers: new Headers() }) as any;

beforeEach(() => {
  h.session = null;
  state.capturedDayFilter = null;
  state.days = [];
  state.users = [];
  state.counts = [];
  vi.clearAllMocks();
});

describe("GET /api/reports/attendance — scoping", () => {
  it("401 when unauthenticated", async () => {
    expect((await reports(req())).status).toBe(401);
  });

  it("always scopes the query to the caller's company", async () => {
    h.session = session("admin");
    await reports(req());
    expect(state.capturedDayFilter.companyId).toBe(COMPANY);
  });

  it("EMPLOYEE: forces employeeId to the session user (cannot read others)", async () => {
    h.session = session("employee");
    await reports(req(`?employeeId=${OTHER_EMP}`)); // tries to read a colleague
    expect(String(state.capturedDayFilter.employeeId)).toBe(EMP_ID);
    expect(state.capturedDayFilter.companyId).toBe(COMPANY);
  });

  it("ADMIN: a cross-company employeeId is still constrained by companyId", async () => {
    h.session = session("admin", "650000000000000000000002");
    await reports(req(`?employeeId=${OTHER_EMP}`));
    // The id is honoured, but companyId guarantees no other company's data leaks.
    expect(String(state.capturedDayFilter.employeeId)).toBe(OTHER_EMP);
    expect(state.capturedDayFilter.companyId).toBe(COMPANY);
  });

  it("400 on an invalid siteId (no 500 / BSONError leak)", async () => {
    h.session = session("admin");
    const res = await reports(req("?siteId=not-an-objectid"));
    expect(res.status).toBe(400);
  });

  it("uniform JSON shape + no-store header", async () => {
    h.session = session("admin");
    const res = await reports(req());
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data.rows)).toBe(true);
  });

  it("CSV INJECTION: a formula in employee name is neutralised in the export", async () => {
    h.session = session("admin");
    state.days = [
      {
        _id: "d1",
        employeeId: "u1",
        workDate: "2026-06-13",
        status: "present",
        firstCheckInAt: null,
        lastCheckOutAt: null,
        totalWorkSeconds: 0,
      },
    ];
    state.users = [
      {
        _id: "u1",
        fullName: '=HYPERLINK("http://evil","x")',
        employeeCode: "E1",
        email: "a@a.com",
      },
    ];
    const res = await reports(req("?format=csv"));
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    // The name cell is prefixed with a single quote (formula neutralised) and
    // quote-wrapped because it contains commas/quotes.
    expect(body).toContain(`"'=HYPERLINK`);
    // It must NOT appear as a live (comma-led) formula.
    expect(body).not.toContain(",=HYPERLINK");
  });
});
