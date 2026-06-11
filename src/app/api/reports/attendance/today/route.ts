/**
 * Today's attendance summary across the company.
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AttendanceDay, User } from "@/models";
import { requireAuth, ok, withApi } from "@/lib/api-helpers";
import { todayWorkDate } from "@/lib/workdate";
import { Company } from "@/models";

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  const company = await Company.findById(session.user.companyId).lean();
  const timezone = company?.timezone || "Asia/Kolkata";
  const workDate = todayWorkDate(timezone);

  const filter: any = { companyId: session.user.companyId, workDate };
  if (session.user.role === "manager") {
    const team = await User.find({ managerId: session.user.id }).select("_id").lean();
    filter.employeeId = { $in: team.map((u: { _id: unknown }) => u._id) };
  } else if (session.user.role === "employee") {
    filter.employeeId = session.user.id;
  }

  const days = await AttendanceDay.find(filter).lean();

  const summary = {
    total: days.length,
    present: days.filter((d: { status: string }) => d.status === "present").length,
    late: days.filter((d: { status: string }) => d.status === "late").length,
    absent: days.filter((d: { status: string }) => d.status === "absent").length,
    half_day: days.filter((d: { status: string }) => d.status === "half_day").length,
    flagged: days.filter((d: { isFlagged: boolean }) => d.isFlagged).length,
    on_leave: days.filter((d: { status: string }) => d.status === "on_leave").length,
  };

  return ok({ summary, days });
});