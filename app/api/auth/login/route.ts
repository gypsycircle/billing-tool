// app/api/auth/login/route.ts
// POST /api/auth/login — sign in with { code }: starts a session. Open to signed-out
//                        visitors. Too many attempts → 429 (Retry-After); a wrong
//                        code → 401; a malformed body → 422.

import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { getClientIp } from "@/lib/server/security/client-ip";
import { logIn } from "@/lib/server/session/login";

export const POST = withApiRoute({ auth: false, body: true }, async ({ request, body }) => {
  await logIn(body, getClientIp(request));
  return jsonOk({ ok: true });
});

export const GET = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
