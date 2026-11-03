// app/api/health/route.ts
// GET /api/health — database connectivity, collections and indexes, the number of
//                   bookings, and whether an access code is set: 200 when healthy,
//                   else 503. Booleans and a count only; always needs a session.

import { getHealth } from "@/lib/server/health/service";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";

export const GET = withApiRoute({}, async () => {
  const health = await getHealth();
  return jsonOk(health, health.status === "healthy" ? 200 : 503);
});

export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
