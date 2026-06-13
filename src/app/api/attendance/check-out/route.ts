import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Company } from "@/models";
import { requireAuth } from "@/lib/api-helpers";
import { CheckOutSchema } from "@/lib/validators";
import { parseJson, ok, fail, withApi } from "@/lib/api-helpers";
import { processCheckOut } from "@/lib/attendance-service";

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  if (session.user.role !== "employee") {
    return fail("Only employees can check out", 403);
  }

  const body = await parseJson(req, CheckOutSchema);
  const { lat, lng, accuracy, isMockLocation } = body;

  const company = await Company.findById(session.user.companyId).lean();
  const timezone = company?.timezone || "Asia/Kolkata";

  const result = await processCheckOut({
    employeeId: session.user.id,
    companyId: session.user.companyId,
    timezone,
    lat,
    lng,
    accuracyMeters: accuracy,
    isMockLocation,
    capturedAt: body.capturedAt,
  });

  if (!result.ok) {
    return fail(result.reason, 400);
  }

  return ok({
    session: result.session,
    day: result.day,
  });
});