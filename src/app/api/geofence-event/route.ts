/**
 * NATIVE GEOFENCE FALLBACK endpoint (app killed).
 *
 * The Android OS geofence receiver POSTs ENTER/EXIT here while the app is dead.
 * Authenticated by a stateless native token (no session cookie). ENTER -> auto
 * check-in (coarse, geofence-sourced); EXIT -> auto check-out. The precise
 * app-open ping system remains the primary path and is untouched.
 */
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { parseJson, ok, fail, withApi } from "@/lib/api-helpers";
import { GeofenceEventSchema } from "@/lib/validators";
import { verifyNativeToken } from "@/lib/native-token";
import { processGeofenceEnter, processGeofenceExit } from "@/lib/attendance-service";
import { User } from "@/models";

export const dynamic = "force-dynamic";

export const POST = withApi(async (req: NextRequest) => {
  const body = await parseJson(req, GeofenceEventSchema);

  const payload = verifyNativeToken(body.token);
  if (!payload) return fail("Invalid or expired token", 401);

  // The token is stateless, so still confirm the employee exists and is active.
  const user = await User.findOne({
    _id: new Types.ObjectId(payload.employeeId),
    companyId: new Types.ObjectId(payload.companyId),
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!user) return fail("Employee not found or inactive", 403);

  const common = {
    employeeId: payload.employeeId,
    companyId: payload.companyId,
    lat: body.lat,
    lng: body.lng,
    accuracyMeters: body.accuracy,
    capturedAt: body.capturedAt,
  };

  const result =
    body.transition === "EXIT"
      ? await processGeofenceExit(common)
      : await processGeofenceEnter({ ...common, deviceId: "geofence" });

  return ok({ transition: body.transition, result });
});
