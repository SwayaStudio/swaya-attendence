import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { EmployeeSiteAssignment } from "@/models";
import { requireAuth, requireRole, ok, withApi, fail } from "@/lib/api-helpers";
import { z } from "zod";

const Schema = z.object({
  employeeId: z.string(),
  siteIds: z.array(z.string()),
});

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId");
  const filter: any = { companyId: session.user.companyId, isActive: true };
  if (employeeId) filter.employeeId = new Types.ObjectId(employeeId);
  const assignments = await EmployeeSiteAssignment.find(filter).lean();
  return ok({ assignments });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireRole(["admin", "super_admin", "manager"]);
  const body = Schema.parse(await req.json());

  // Soft-deactivate existing
  await EmployeeSiteAssignment.updateMany(
    { companyId: session.user.companyId, employeeId: new Types.ObjectId(body.employeeId), isActive: true },
    { $set: { isActive: false, validTo: new Date() } }
  );

  const created = await Promise.all(
    body.siteIds.map((siteId, i) =>
      EmployeeSiteAssignment.create({
        companyId: new Types.ObjectId(session.user.companyId),
        employeeId: new Types.ObjectId(body.employeeId),
        siteId: new Types.ObjectId(siteId),
        validFrom: new Date(),
        isActive: true,
        isPrimary: i === 0,
      })
    )
  );
  return ok({ assignments: created }, { status: 201 });
});