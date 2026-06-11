import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Holiday } from "@/models";
import { requireRole, ok, withApi, fail } from "@/lib/api-helpers";

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