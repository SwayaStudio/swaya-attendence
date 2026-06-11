import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AttendanceDay, GeofenceEvent, OutsideSiteLog, AttendanceSession } from "@/models";
import { requireAuth, ok, withApi } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") || 30));
  const employeeId = url.searchParams.get("employeeId") || session.user.id;

  // Employees can only see their own history; managers/admins can query team
  if (
    session.user.role === "employee" &&
    employeeId !== session.user.id
  ) {
    return ok({ days: [] });
  }

  const days = await AttendanceDay.find({
    companyId: session.user.companyId,
    employeeId,
  })
    .sort({ workDate: -1 })
    .limit(limit)
    .lean();

  // For each day, fetch geofence events + outside logs
  const dayIds = days.map((d: { _id: unknown }) => d._id);
  const [events, logs, sessions] = await Promise.all([
    GeofenceEvent.find({ attendanceDayId: { $in: dayIds } })
      .sort({ eventAt: 1 })
      .lean(),
    OutsideSiteLog.find({ attendanceDayId: { $in: dayIds } })
      .sort({ exitedAt: 1 })
      .lean(),
    AttendanceSession.find({ attendanceDayId: { $in: dayIds } })
      .sort({ checkInAt: 1 })
      .lean(),
  ]);

  return ok({ days, events, logs, sessions });
});