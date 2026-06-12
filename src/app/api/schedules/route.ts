/**
 * Schedules: list + bulk upsert for a given date.
 */
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { EmployeeSchedule, ShiftTemplate, WorkSite, Company } from "@/models";
import { requireAuth, requireRole, ok, withApi } from "@/lib/api-helpers";
import { ScheduleBulkSchema } from "@/lib/validators";
import { zonedDateTimeToUtc } from "@/lib/workdate";

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const filter: any = { companyId: session.user.companyId };
  if (from || to) {
    filter.workDate = {};
    if (from) filter.workDate.$gte = from;
    if (to) filter.workDate.$lte = to;
  }
  const schedules = await EmployeeSchedule.find(filter).lean();
  return ok({ schedules });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireRole(["admin", "super_admin", "manager"]);
  const body = ScheduleBulkSchema.parse(await req.json());
  const company = await Company.findById(session.user.companyId).lean();
  const timezone = company?.timezone || "Asia/Kolkata";

  const created: any[] = [];
  for (const e of body.entries) {
    if (!Types.ObjectId.isValid(e.employeeId) || !Types.ObjectId.isValid(e.siteId) || !Types.ObjectId.isValid(e.shiftTemplateId)) {
      continue;
    }
    const shift = await ShiftTemplate.findById(e.shiftTemplateId).lean();
    let expectedStartAt: Date | undefined;
    let expectedEndAt: Date | undefined;
    if (shift) {
      expectedStartAt = zonedDateTimeToUtc(body.workDate, shift.startTime, timezone);
      expectedEndAt = zonedDateTimeToUtc(body.workDate, shift.endTime, timezone);
    }
    const result = await EmployeeSchedule.findOneAndUpdate(
      {
        employeeId: new Types.ObjectId(e.employeeId),
        workDate: body.workDate,
      },
      {
        $set: {
          companyId: new Types.ObjectId(session.user.companyId),
          siteId: new Types.ObjectId(e.siteId),
          shiftTemplateId: new Types.ObjectId(e.shiftTemplateId),
          isWorkingDay: e.isWorkingDay,
          expectedStartAt,
          expectedEndAt,
        },
      },
      { upsert: true, new: true }
    );
    created.push(result.toObject());
  }
  return ok({ schedules: created }, { status: 201 });
});