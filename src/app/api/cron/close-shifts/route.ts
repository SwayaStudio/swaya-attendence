/**
 * Cron backstop: auto check-out every session whose scheduled shift end has
 * passed. Runs on a Vercel Cron schedule (see vercel.json). Secured with
 * CRON_SECRET — Vercel sends it as `Authorization: Bearer <CRON_SECRET>`.
 */
import { NextRequest } from "next/server";
import { ok, fail, withApi } from "@/lib/api-helpers";
import { autoCloseEndedShifts } from "@/lib/attendance-service";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = withApi(async (req: NextRequest) => {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) return fail("Unauthorized", 401);
  } else if (env.NODE_ENV === "production") {
    // Fail CLOSED: never expose an unauthenticated state-changing endpoint in
    // production. Without a configured secret the job is disabled, not open.
    return fail("Cron secret not configured", 503);
  }
  const closed = await autoCloseEndedShifts();
  return ok({ closed });
});
