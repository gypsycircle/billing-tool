// lib/server/health/service.ts
// The health check behind /api/health: database connectivity, collections and
// indexes, the number of bookings, and whether an access code is set.
// Booleans and a count only; the underlying error is logged here (redacted),
// never sent to the client.

import "server-only";

import type { HealthCheckResult } from "@/lib/domain/types";
import { checkDatabase } from "../db/bookings-repo";
import { verifySession } from "../guards";
import { sanitizeLogMessage } from "../http/respond";

export async function getHealth(): Promise<HealthCheckResult> {
  await verifySession();
  const result = await checkDatabase();
  if (result.error) console.error("[Health]", sanitizeLogMessage(result.error));
  const healthy = result.connected && result.collectionsReady && result.accessCodeSet;
  return {
    status: healthy ? "healthy" : "unhealthy",
    dbConnected: result.connected,
    collectionsReady: result.collectionsReady,
    totalBookings: result.totalBookings,
    accessCodeSet: result.accessCodeSet,
  };
}
