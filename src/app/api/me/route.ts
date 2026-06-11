/**
 * /api/me — returns the current session user (or 401).
 * Used by the client to fetch the role + companyId for routing decisions.
 */
import { withApi, ok, requireAuth } from "@/lib/api-helpers";

export const GET = withApi(async () => {
  const session = await requireAuth();
  return ok({ user: session.user });
});
