// app/api/auth/logout/route.ts
// POST /api/auth/logout — sign out: clears the session cookie. Open to everyone and
//                         idempotent, so an expired or broken cookie can always be cleared.

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
