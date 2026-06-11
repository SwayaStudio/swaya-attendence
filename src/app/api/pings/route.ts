/**
 * Batch ping ingest endpoint.
 * Accepts a batch of GPS pings from the client.
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { PingBatchSchema } from "@/lib/validators";
import { parseJson, ok, fail, withApi } from "@/lib/api-helpers";
import { processPings } from "@/lib/attendance-service";

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireAuth();
  if (session.user.role !== "employee") {
    return fail("Only employees can submit pings", 403);
  }

  const body = await parseJson(req, PingBatchSchema);
  const result = await processPings({
    employeeId: session.user.id,
    companyId: session.user.companyId,
    pings: body.pings,
  });

  if (!result.ok) {
    return fail(result.reason, 400);
  }

  return ok({ received: result.received });
});