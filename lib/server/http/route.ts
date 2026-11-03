// lib/server/http/route.ts
// withApiRoute: every Route Handler is written as one of these, so a route
// holds only its own step (call the service, answer). The wrapper runs, in
// this order, inside one error handler (handleApiError):
//   1. session        (auth, default true)                    → 401
//   2. same-origin    (sameOrigin, or implied by body)        → 403
//   3. JSON body type (body)                                  → 415
//   4. the JSON body  (body: read, size-capped, parsed)       → 413 / 400
// and hands the handler the request, its params, its query and its body.

import "server-only";

import { hasValidSession } from "../session/cookies";
import { readJsonBody } from "../security/body";
import { assertJsonContentType, assertSameOrigin } from "../security/origin";
import { handleApiError, jsonError } from "./respond";

interface ApiRouteOptions {
  /** Require a valid session (default true). */
  auth?: boolean;
  /** Reject cross-origin requests: every write (a body implies it). */
  sameOrigin?: boolean;
  /** The request carries a JSON body (POST, PATCH): checks its type and reads it. */
  body?: boolean;
}

interface ApiRouteContext<P> {
  request: Request;
  params: P;
  /** The URL's query parameters (the first of a repeated one). */
  query: Record<string, string>;
  /** The parsed JSON body (routes with `body`); validated by the service. */
  body: unknown;
}

/** Each query parameter's first value, as pages read them (`param` in lib/domain/filters.ts). */
export function firstValues(params: URLSearchParams): Record<string, string> {
  const first = new Map<string, string>();
  for (const [key, value] of params) if (!first.has(key)) first.set(key, value);
  return Object.fromEntries(first);
}

/** The params of a route under [id]. */
export type IdParams = { id: string };

type RouteSegment<P> = { params: Promise<P> };

export function withApiRoute<P = Record<string, never>>(
  options: ApiRouteOptions,
  handler: (context: ApiRouteContext<P>) => Promise<Response>
) {
  const { auth = true, body: hasBody = false } = options;
  const sameOrigin = options.sameOrigin || hasBody;

  return async (request: Request, segment?: RouteSegment<P>): Promise<Response> => {
    try {
      if (auth && !(await hasValidSession())) {
        return jsonError("Unauthorized. Please log in with a valid access code.", 401);
      }
      const denied = (sameOrigin && assertSameOrigin(request)) || (hasBody && assertJsonContentType(request));
      if (denied) return denied;

      let body: unknown;
      if (hasBody) {
        const read = await readJsonBody(request);
        if (read.error) return read.error;
        body = read.data;
      }
      const params = (segment ? await segment.params : {}) as P;
      const query = firstValues(new URL(request.url).searchParams);
      return await handler({ request, params, query, body });
    } catch (err) {
      return handleApiError(err);
    }
  };
}
