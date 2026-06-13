import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Company } from "@/models";
import { requireAuth } from "@/lib/api-helpers";
import { CheckInSchema } from "@/lib/validators";
import { parseJson, ok, fail, withApi } from "@/lib/api-helpers";
import { processCheckIn } from "@/lib/attendance-service";

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  if (session.user.role !== "employee") {
    return fail("Only employees can check in", 403);
  }

  const body = await parseJson(req, CheckInSchema);
  const { lat, lng, accuracy, isMockLocation, deviceId, appVersion, appState, networkType, batteryPercentage } = body;

  // fetch company timezone
  const company = await Company.findById(session.user.companyId).lean();
  const timezone = company?.timezone || "Asia/Kolkata";

  const result = await processCheckIn({
    employeeId: session.user.id,
    companyId: session.user.companyId,
    timezone,
    lat,
    lng,
    accuracyMeters: accuracy,
    isMockLocation,
    deviceId,
    appVersion,
    appState: appState as any,
    networkType: networkType as any,
    batteryPercentage,
    capturedAt: body.capturedAt,
  });

  if (!result.ok) {
    return fail(result.reason, 400, {
      nearestSite: result.nearestSite,
      distance: result.distance,
    });
  }

  return ok({
    attendanceDay: result.attendanceDay,
    session: result.session,
    site: result.site,
  });
});