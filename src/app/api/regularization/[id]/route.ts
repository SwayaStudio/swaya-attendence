import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { RegularizationRequest, AttendanceDay, User } from "@/models";
import { requireAuth, ok, withApi, fail } from "@/lib/api-helpers";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const ReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewerNote: z.string().optional(),
});

export const PATCH = withApi(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const session = await requireAuth();
  if (!["manager", "admin", "super_admin"].includes(session.user.role)) {
    return fail("Forbidden", 403);
  }
  if (!Types.ObjectId.isValid(ctx.params.id)) return fail("Invalid id", 400);
  const body = ReviewSchema.parse(await req.json());

  const request = await RegularizationRequest.findOne({
    _id: ctx.params.id,
    companyId: session.user.companyId,
  });
  if (!request) return fail("Not found", 404);
  request.status = body.status;
  request.reviewerNote = body.reviewerNote;
  request.reviewedBy = new Types.ObjectId(session.user.id);
  request.reviewedAt = new Date();
  await request.save();

  // Update attendance day
  const day = await AttendanceDay.findById(request.attendanceDayId);
  if (day && body.status === "approved") {
    if (request.requestedCheckInAt) day.firstCheckInAt = request.requestedCheckInAt;
    if (request.requestedCheckOutAt) day.lastCheckOutAt = request.requestedCheckOutAt;
    day.approvedBy = new Types.ObjectId(session.user.id);
    day.approvedAt = new Date();
    await day.save();
  }

  // Email employee
  const employee = await User.findById(request.employeeId).lean();
  if (employee) {
    await sendEmail({
      to: employee.email,
      subject: `Your regularization request was ${body.status}`,
      html: `<p>Your request (${request.requestType}) was <b>${body.status}</b>${body.reviewerNote ? " — " + body.reviewerNote : ""}.</p>`,
    });
  }

  return ok({ request });
});