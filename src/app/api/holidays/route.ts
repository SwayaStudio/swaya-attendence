import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Holiday } from "@/models";
import { requireAuth, requireRole, ok, withApi, fail } from "@/lib/api-helpers";
import { HolidaySchema } from "@/lib/validators";

export const GET = withApi(async (_req: NextRequest) => {
  const session = await requireAuth();
  const holidays = await Holiday.find({ companyId: session.user.companyId })
    .sort({ holidayDate: 1 })
    .lean();
  return ok({ holidays });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireRole(["admin", "super_admin"]);
  const body = HolidaySchema.parse(await req.json());
  const exists = await Holiday.findOne({
    companyId: session.user.companyId,
    holidayDate: body.holidayDate,
  });
  if (exists) return fail("Holiday already exists for that date", 409);
  const holiday = await Holiday.create({
    companyId: new Types.ObjectId(session.user.companyId),
    name: body.name,
    holidayDate: body.holidayDate,
  });
  return ok({ holiday }, { status: 201 });
});