// lib/server/http/route.ts
// withApiRoute — wraps a Route Handler with the standard guards so each route
// only contains its own logic. Guards run in this order:
//   1. session        (auth, default true)        → 401
//   2. same-origin    (sameOrigin, default false)  → 403
//   3. JSON body type (json, default false)        → 415
// Any error thrown by the handler goes through handleApiError.

import "server-only";

import { hasValidSession } from "../session/cookies";
import { assertJsonContentType, assertSameOrigin } from "../security/origin";
import { handleApiError, jsonError } from "./respond";

interface ApiRouteOptions {
  /** Require a valid session (default true). */
  auth?: boolean;
  /** Reject cross-origin requests — use on every mutating method. */
  sameOrigin?: boolean;
  /** Require Content-Type: application/json. */
  json?: boolean;
}

interface ApiRouteContext<P> {
  request: Request;
  params: P;
}

type RouteSegment<P> = { params: Promise<P> };

export function withApiRoute<P = Record<string, never>>(
  options: ApiRouteOptions,
  handler: (context: ApiRouteContext<P>) => Promise<Response>
) {
  const { auth = true, sameOrigin = false, json = false } = options;

  return async (request: Request, segment?: RouteSegment<P>): Promise<Response> => {
    if (auth && !(await hasValidSession())) {
      return jsonError("Unauthorized. Please log in with a valid access code.", 401);
    }
    if (sameOrigin) {
      const denied = assertSameOrigin(request);
      if (denied) return denied;
    }
    if (json) {
      const denied = assertJsonContentType(request);
      if (denied) return denied;
    }

    try {
      const params = (segment ? await segment.params : {}) as P;
      return await handler({ request, params });
    } catch (err) {
      return handleApiError(err);
    }
  };
}
