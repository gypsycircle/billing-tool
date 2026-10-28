// app/api/auth/logout/route.ts
// POST /api/auth/logout — clears the session cookie.
// Idempotent, and exempt from the session requirement so users with an
// expired or garbage cookie can always clear it.

import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { clearSession } from "@/lib/server/session/cookies";

export const POST = withApiRoute({ auth: false, sameOrigin: true }, async () => {
  await clearSession();
  return jsonOk({ ok: true });
});

export const GET = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
