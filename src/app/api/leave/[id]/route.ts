import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { LeaveRequest, User } from "@/models";
import { requireAuth, ok, withApi, fail } from "@/lib/api-helpers";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const ReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "cancelled"]),
  reviewerNote: z.string().optional(),
});

export const PATCH = withApi(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const session = await requireAuth();
  if (!Types.ObjectId.isValid(ctx.params.id)) return fail("Invalid id", 400);
  const body = ReviewSchema.parse(await req.json());

  const leave = await LeaveRequest.findOne({
    _id: ctx.params.id,
    companyId: session.user.companyId,
  });
  if (!leave) return fail("Not found", 404);
  // employee can only cancel
  if (session.user.role === "employee" && body.status !== "cancelled") {
    return fail("Employees can only cancel their own leave", 403);
  }
  if (session.user.role === "employee" && String(leave.employeeId) !== session.user.id) {
    return fail("Forbidden", 403);
  }
  leave.status = body.status;
  leave.reviewerNote = body.reviewerNote;
  leave.reviewedBy = new Types.ObjectId(session.user.id);
  leave.reviewedAt = new Date();
  await leave.save();

  const employee = await User.findById(leave.employeeId).lean();
  if (employee) {
    await sendEmail({
      to: employee.email,
      subject: `Your leave request was ${body.status}`,
      html: `<p>Your ${leave.leaveType} leave (${leave.startDate} → ${leave.endDate}) was <b>${body.status}</b>.</p>`,
    });
  }
  return ok({ leave });
});