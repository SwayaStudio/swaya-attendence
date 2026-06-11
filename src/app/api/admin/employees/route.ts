/**
 * Employees CRUD (admin)
 */
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, EmployeeSiteAssignment } from "@/models";
import { requireRole, ok, withApi, fail } from "@/lib/api-helpers";
import { EmployeeCreateSchema } from "@/lib/validators";

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireRole(["admin", "super_admin", "manager"]);
  const url = new URL(req.url);
  const role = url.searchParams.get("role") || undefined;
  const filter: any = { companyId: session.user.companyId };
  if (role) filter.role = role;
  const users = await User.find(filter).sort({ fullName: 1 }).lean();
  // strip sensitive
  const safe = users.map((u) => ({
    id: String(u._id),
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    employeeCode: u.employeeCode,
    department: u.department,
    designation: u.designation,
    isActive: u.isActive,
    managerId: u.managerId ? String(u.managerId) : null,
  }));
  return ok({ employees: safe });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireRole(["admin", "super_admin"]);
  const body = EmployeeCreateSchema.parse(await req.json());
  const exists = await User.findOne({ email: body.email }).lean();
  if (exists) return fail("Email already in use", 409);

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    companyId: new Types.ObjectId(session.user.companyId),
    fullName: body.fullName,
    email: body.email,
    passwordHash,
    phone: body.phone,
    employeeCode: body.employeeCode,
    department: body.department,
    designation: body.designation,
    role: body.role,
    managerId: body.managerId ? new Types.ObjectId(body.managerId) : null,
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : new Date(),
    isActive: true,
  });

  // Site assignments
  if (body.siteIds && body.siteIds.length) {
    await Promise.all(
      body.siteIds.map((siteId, i) =>
        EmployeeSiteAssignment.create({
          companyId: new Types.ObjectId(session.user.companyId),
          employeeId: user._id,
          siteId: new Types.ObjectId(siteId),
          validFrom: new Date(),
          isActive: true,
          isPrimary: i === 0,
        })
      )
    );
  }

  return ok(
    {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
    { status: 201 }
  );
});