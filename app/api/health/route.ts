// app/api/health/route.ts
// GET /api/health — database connectivity, collections and indexes, the
// number of bookings, and whether an access code is set. Always requires a session (no dev bypass). Returns
// booleans and a count only; the underlying error is logged server-side,
// never sent to the client.

import type { HealthCheckResult } from "@/lib/domain/types";
import { checkDatabaseHealth } from "@/lib/server/bookings/service";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed, sanitizeLogMessage } from "@/lib/server/http/respond";

export const GET = withApiRoute({}, async () => {
  const result = await checkDatabaseHealth();
  const healthy = result.connected && result.collectionsReady && result.accessCodeSet;

  if (result.error) {
    console.error("[Health]", sanitizeLogMessage(result.error));
  }

  const response: HealthCheckResult = {
    status: healthy ? "healthy" : "unhealthy",
    dbConnected: result.connected,
    collectionsReady: result.collectionsReady,
    totalBookings: result.totalBookings,
    accessCodeSet: result.accessCodeSet,
  };
  return jsonOk(response, healthy ? 200 : 503);
});

export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
