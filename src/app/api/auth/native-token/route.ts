/**
 * Issues a stateless token the native OS-geofence receiver uses to authenticate
 * its uploads (it has no WebView session cookie). The web app calls this once
 * after login and stores the token via Capacitor Preferences for the native side.
 */
import { requireAuth, ok, fail, withApi } from "@/lib/api-helpers";
import { mintNativeToken } from "@/lib/native-token";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const session = await requireAuth();
  if (session.user.role !== "employee") {
    return fail("Only employees have a tracking token", 403);
  }
  const token = mintNativeToken(session.user.id, session.user.companyId);
  return ok({ token });
});
