import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { LeaveRequest, User } from "@/models";
import { requireAuth, ok, withApi, fail } from "@/lib/api-helpers";
import { LeaveCreateSchema } from "@/lib/validators";
import { sendEmail } from "@/lib/email";

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const filter: any = { companyId: session.user.companyId };
  if (status) filter.status = status;
  if (session.user.role === "employee") {
    filter.employeeId = new Types.ObjectId(session.user.id);
  } else if (session.user.role === "manager") {
    const team = await User.find({ managerId: new Types.ObjectId(session.user.id) }).select("_id").lean();
    filter.employeeId = { $in: team.map((u: { _id: unknown }) => u._id) };
  }
  const leaves = await LeaveRequest.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return ok({ leaves });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  const body = LeaveCreateSchema.parse(await req.json());
  if (body.endDate < body.startDate) return fail("endDate must be >= startDate", 400);
  const leave = await LeaveRequest.create({
    companyId: new Types.ObjectId(session.user.companyId),
    employeeId: new Types.ObjectId(session.user.id),
    ...body,
  });
  const me = await User.findById(session.user.id).lean();
  if (me?.managerId) {
    const manager = await User.findById(me.managerId).lean();
    if (manager) {
      await sendEmail({
        to: manager.email,
        subject: `Leave request from ${me.fullName}`,
        html: `<p>${me.fullName} has requested ${body.leaveType} leave from ${body.startDate} to ${body.endDate}.</p>`,
      });
    }
  }
  return ok({ leave }, { status: 201 });
});