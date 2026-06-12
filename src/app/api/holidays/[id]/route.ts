import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Holiday } from "@/models";
import { requireRole, ok, withApi, fail } from "@/lib/api-helpers";
import { HolidaySchema } from "@/lib/validators";

export const PATCH = withApi(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const session = await requireRole(["admin", "super_admin"]);
  if (!Types.ObjectId.isValid(ctx.params.id)) return fail("Invalid id", 400);
  const body = HolidaySchema.partial().parse(await req.json());

  // If the date is changing, make sure another holiday doesn't already use it.
  if (body.holidayDate) {
    const dup = await Holiday.findOne({
      companyId: session.user.companyId,
      holidayDate: body.holidayDate,
      _id: { $ne: ctx.params.id },
    }).lean();
    if (dup) return fail("Holiday already exists for that date", 409);
  }

  const holiday = await Holiday.findOneAndUpdate(
    { _id: ctx.params.id, companyId: session.user.companyId },
    { $set: body },
    { new: true }
  );
  if (!holiday) return fail("Not found", 404);
  return ok({ holiday });
});

export const DELETE = withApi(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const session = await requireRole(["admin", "super_admin"]);
  if (!Types.ObjectId.isValid(ctx.params.id)) return fail("Invalid id", 400);
  const holiday = await Holiday.findOneAndDelete({
    _id: ctx.params.id,
    companyId: session.user.companyId,
  });
  if (!holiday) return fail("Not found", 404);
  return ok({ id: ctx.params.id });
});
