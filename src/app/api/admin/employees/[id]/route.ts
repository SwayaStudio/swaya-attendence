import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { requireRole, ok, withApi, fail } from "@/lib/api-helpers";
import { z } from "zod";

const PatchSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  employeeCode: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  managerId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
});

export const PATCH = withApi(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const session = await requireRole(["admin", "super_admin"]);
  if (!Types.ObjectId.isValid(ctx.params.id)) return fail("Invalid id", 400);
  const body = PatchSchema.parse(await req.json());
  const update: any = { ...body };
  if (body.managerId) update.managerId = new Types.ObjectId(body.managerId);
  if (body.managerId === null) update.managerId = null;
  const user = await User.findOneAndUpdate(
    { _id: ctx.params.id, companyId: session.user.companyId },
    { $set: update },
    { new: true }
  ).lean();
  if (!user) return fail("Not found", 404);
  return ok({ id: String(user._id), fullName: user.fullName, role: user.role, isActive: user.isActive });
});

export const DELETE = withApi(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const session = await requireRole(["admin", "super_admin"]);
  if (!Types.ObjectId.isValid(ctx.params.id)) return fail("Invalid id", 400);
  const user = await User.findOneAndUpdate(
    { _id: ctx.params.id, companyId: session.user.companyId },
    { $set: { isActive: false } },
    { new: true }
  ).lean();
  if (!user) return fail("Not found", 404);
  return ok({ id: String(user._id) });
});