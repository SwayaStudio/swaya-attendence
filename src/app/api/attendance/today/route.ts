import { NextRequest } from "next/server";
import { AttendanceDay, AttendanceSession, WorkSite, EmployeeSchedule, ShiftTemplate, LeaveRequest } from "@/models";
import { requireAuth, ok, withApi } from "@/lib/api-helpers";
import { liveTotalsForActiveSession } from "@/lib/attendance-service";
import { getCompanyTimezone } from "@/lib/company";
import { todayWorkDate } from "@/lib/workdate";

export const dynamic = "force-dynamic";

export const GET = withApi(async (_req: NextRequest) => {
  const session = await requireAuth();

  const timezone = await getCompanyTimezone(session.user.companyId);
  const workDate = todayWorkDate(timezone);

  // The day, the approved-leave check, and the live totals are independent — run
  // them in parallel instead of serially.
  const [day, leave, live] = await Promise.all([
    AttendanceDay.findOne({ employeeId: session.user.id, workDate }).lean(),
    LeaveRequest.findOne({
      employeeId: session.user.id,
      status: "approved",
      startDate: { $lte: workDate },
      endDate: { $gte: workDate },
    }).lean(),
    liveTotalsForActiveSession(session.user.id),
  ]);

  // These depend on `day`; once we have it, fetch them together.
  const [sessions, site, schedule] = await Promise.all([
    day ? AttendanceSession.find({ attendanceDayId: day._id }).sort({ checkInAt: 1 }).lean() : [],
    day ? WorkSite.findById(day.siteId).lean() : null,
    day?.scheduleId
      ? EmployeeSchedule.findById(day.scheduleId).lean()
      : EmployeeSchedule.findOne({ employeeId: session.user.id, workDate }).lean(),
  ]);

  const shift = schedule?.shiftTemplateId
    ? await ShiftTemplate.findById(schedule.shiftTemplateId).lean()
    : null;

  // If a session is open, overlay live (cumulative) totals so the dashboard shows
  // work/outside time changing while checked in.
  const dayOut = live && day ? { ...day, ...live } : day;

  return ok({ day: dayOut, sessions, site, schedule, shift, leave });
});
