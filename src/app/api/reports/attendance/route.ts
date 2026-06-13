/**
 * Attendance reports — JSON or CSV.
 */
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { AttendanceDay, AttendanceSession, User } from "@/models";
import { requireAuth, ok, withApi, fail } from "@/lib/api-helpers";
import { csvEscape } from "@/lib/csv";

export const dynamic = "force-dynamic";

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const siteId = url.searchParams.get("siteId") || "";
  const employeeIdParam = url.searchParams.get("employeeId") || "";
  const format = url.searchParams.get("format") || "json";

  // Reject malformed ids up front with a 400 (otherwise `new Types.ObjectId`
  // throws a BSONError that surfaces as a 500).
  if (siteId && !Types.ObjectId.isValid(siteId)) return fail("Invalid siteId", 400);
  if (employeeIdParam && !Types.ObjectId.isValid(employeeIdParam)) {
    return fail("Invalid employeeId", 400);
  }

  const filter: any = { companyId: session.user.companyId };
  if (from || to) {
    filter.workDate = {};
    if (from) filter.workDate.$gte = from;
    if (to) filter.workDate.$lte = to;
  }
  if (siteId) filter.siteId = new Types.ObjectId(siteId);
  if (employeeIdParam) filter.employeeId = new Types.ObjectId(employeeIdParam);

  // Role scoping
  if (session.user.role === "employee") {
    filter.employeeId = new Types.ObjectId(session.user.id);
  } else if (session.user.role === "manager") {
    const team = await User.find({ managerId: new Types.ObjectId(session.user.id) })
      .select("_id")
      .lean();
    filter.employeeId = { $in: team.map((u: { _id: unknown }) => u._id) };
  }

  const days = await AttendanceDay.find(filter).sort({ workDate: -1 }).limit(5000).lean();
  const userIds = Array.from(new Set(days.map((d: { employeeId: unknown }) => String(d.employeeId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id fullName employeeCode email")
    .lean();
  const userMap = new Map(users.map((u: { _id: unknown; fullName: string; employeeCode?: string; email: string }) => [String(u._id), u]));

  // How many times each employee actually checked out that day (one count per
  // completed session — includes auto check-outs). Single aggregation, no N+1.
  const dayIds = days.map((d: { _id: unknown }) => d._id);
  const counts = await AttendanceSession.aggregate([
    { $match: { attendanceDayId: { $in: dayIds }, checkOutAt: { $ne: null } } },
    { $group: { _id: "$attendanceDayId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c: { _id: unknown; count: number }) => [String(c._id), c.count]));

  const rows = days.map((d: { _id: unknown; employeeId: unknown }) => {
    const u = userMap.get(String(d.employeeId)) || ({} as any);
    return {
      ...d,
      employeeName: u.fullName,
      employeeCode: u.employeeCode,
      employeeEmail: u.email,
      checkOutCount: countMap.get(String(d._id)) || 0,
    };
  });

  if (format === "csv") {
    const csv = toCsv(rows);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="attendance-${Date.now()}.csv"`,
      },
    });
  }
  return ok({ rows });
});

function toCsv(rows: any[]): string {
  const header = [
    "Date",
    "Employee Code",
    "Name",
    "Email",
    "Status",
    "Check-in",
    "Check-out",
    "Check-out count",
    "Work (sec)",
    "Inside (sec)",
    "Outside (sec)",
    "Late (min)",
    "Flagged",
    "Flag Reasons",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.workDate,
        r.employeeCode || "",
        csvEscape(r.employeeName || ""),
        r.employeeEmail || "",
        r.status,
        r.firstCheckInAt ? new Date(r.firstCheckInAt).toISOString() : "",
        r.lastCheckOutAt ? new Date(r.lastCheckOutAt).toISOString() : "",
        r.checkOutCount || 0,
        r.totalWorkSeconds || 0,
        r.totalInsideSeconds || 0,
        r.totalOutsideSeconds || 0,
        r.lateByMinutes || 0,
        r.isFlagged ? "yes" : "no",
        csvEscape((r.flagReasons || []).join("; ")),
      ].join(",")
    );
  }
  return lines.join("\n");
}