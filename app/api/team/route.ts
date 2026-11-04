// app/api/team/route.ts
// GET  /api/team — every team member (?role=Sales: only that role's), active first, then newest first: { items }.
// POST /api/team — add a team member; answers its reference (201). A name in use → 409.
//
// Creates honour an `Idempotency-Key` header: a retry or double submit gets
// the first result.

import { namedRefOf } from "@/lib/domain/named-records";
import { parseTeamQuery } from "@/lib/domain/team.schema";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { idempotencyKeyOf } from "@/lib/server/http/versioning";
import { createTeamMember, getTeamList } from "@/lib/server/team/service";

export const GET = withApiRoute({}, async ({ query }) => jsonOk({ items: await getTeamList(parseTeamQuery(query)) }));

export const POST = withApiRoute({ body: true }, async ({ request, body }) =>
  jsonOk({ member: namedRefOf(await createTeamMember(body, idempotencyKeyOf(request))) }, 201)
);

export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
