import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import {
  User,
  EmployeeSiteAssignment,
  EmployeeSchedule,
  AttendanceDay,
  AttendanceSession,
  LocationPing,
  GeofenceEvent,
  OutsideSiteLog,
  RegularizationRequest,
  LeaveRequest,
  EmployeeDevice,
} from "@/models";
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

/**
 * Hard delete: permanently remove the employee AND all of their data from the
 * database (assignments, schedules, attendance, pings, geofence events,
 * outside-site logs, regularization/leave requests, devices). Irreversible.
 * The AuditLog (who-did-what trail) is intentionally preserved.
 */
export const DELETE = withApi(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const session = await requireRole(["admin", "super_admin"]);
  if (!Types.ObjectId.isValid(ctx.params.id)) return fail("Invalid id", 400);

  // Guard: an admin cannot delete their own account.
  if (String(session.user.id) === ctx.params.id) {
    return fail("You cannot delete your own account", 400);
  }

  const employeeId = new Types.ObjectId(ctx.params.id);

  // Make sure the employee exists and belongs to the admin's company.
  const user = await User.findOne({
    _id: employeeId,
    companyId: session.user.companyId,
  }).lean();
  if (!user) return fail("Not found", 404);

  // Remove all data owned by this employee, then the user record itself.
  await Promise.all([
    EmployeeSiteAssignment.deleteMany({ employeeId }),
    EmployeeSchedule.deleteMany({ employeeId }),
    AttendanceDay.deleteMany({ employeeId }),
    AttendanceSession.deleteMany({ employeeId }),
    LocationPing.deleteMany({ employeeId }),
    GeofenceEvent.deleteMany({ employeeId }),
    OutsideSiteLog.deleteMany({ employeeId }),
    RegularizationRequest.deleteMany({ employeeId }),
    LeaveRequest.deleteMany({ employeeId }),
    EmployeeDevice.deleteMany({ employeeId }),
  ]);
  await User.deleteOne({ _id: employeeId });

  return ok({ id: ctx.params.id, deleted: true });
});