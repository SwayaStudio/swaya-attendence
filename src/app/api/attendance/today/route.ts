import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AttendanceDay, AttendanceSession, WorkSite, EmployeeSchedule, ShiftTemplate } from "@/models";
import { requireAuth } from "@/lib/api-helpers";
import { ok, withApi } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
import { todayWorkDate } from "@/lib/workdate";
import { Company } from "@/models";

export const GET = withApi(async (_req: NextRequest) => {
  const session = await requireAuth();

  const company = await Company.findById(session.user.companyId).lean();
  const timezone = company?.timezone || "Asia/Kolkata";
  const workDate = todayWorkDate(timezone);

  const day = await AttendanceDay.findOne({
    employeeId: session.user.id,
    workDate,
  }).lean();

  const sessions = day
    ? await AttendanceSession.find({ attendanceDayId: day._id }).sort({ checkInAt: 1 }).lean()
    : [];

  const site = day ? await WorkSite.findById(day.siteId).lean() : null;

  const schedule = day?.scheduleId
    ? await EmployeeSchedule.findById(day.scheduleId).lean()
    : await EmployeeSchedule.findOne({
        employeeId: session.user.id,
        workDate,
      }).lean();

  const shift = schedule?.shiftTemplateId
    ? await ShiftTemplate.findById(schedule.shiftTemplateId).lean()
    : null;

  return ok({ day, sessions, site, schedule, shift });
});