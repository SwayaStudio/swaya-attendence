import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { RegularizationRequest, AttendanceDay, User } from "@/models";
import { requireAuth, ok, withApi, fail } from "@/lib/api-helpers";
import { RegularizationCreateSchema } from "@/lib/validators";
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
    // team
    const team = await User.find({ managerId: new Types.ObjectId(session.user.id) }).select("_id").lean();
    filter.employeeId = { $in: team.map((u: { _id: unknown }) => u._id) };
  }
  const requests = await RegularizationRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  return ok({ requests });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  if (session.user.role !== "employee") {
    return fail("Only employees can request regularization", 403);
  }
  const body = RegularizationCreateSchema.parse(await req.json());
  const day = await AttendanceDay.findOne({
    _id: body.attendanceDayId,
    employeeId: session.user.id,
  }).lean();
  if (!day) return fail("Attendance day not found", 404);

  const request = await RegularizationRequest.create({
    attendanceDayId: day._id,
    companyId: new Types.ObjectId(session.user.companyId),
    employeeId: new Types.ObjectId(session.user.id),
    requestType: body.requestType,
    reason: body.reason,
    requestedCheckInAt: body.requestedCheckInAt ? new Date(body.requestedCheckInAt) : null,
    requestedCheckOutAt: body.requestedCheckOutAt ? new Date(body.requestedCheckOutAt) : null,
  });

  // Email manager
  const me = await User.findById(session.user.id).lean();
  if (me?.managerId) {
    const manager = await User.findById(me.managerId).lean();
    if (manager) {
      await sendEmail({
        to: manager.email,
        subject: `Regularization request from ${me.fullName}`,
        html: `<p>${me.fullName} has submitted a regularization request (${body.requestType}).</p><p>Reason: ${body.reason}</p>`,
      });
    }
  }

  return ok({ request }, { status: 201 });
});