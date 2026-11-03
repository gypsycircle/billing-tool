// app/api/team/[id]/route.ts
// GET    /api/team/[id] — one team member.
// PATCH  /api/team/[id] — name / role / phone changes, or { status: "Active" } on its own (restore).
// DELETE /api/team/[id] — archive (hidden from the Salary dropdown; kept on the expenses
//                         already paid to them).
//
// Writes answer with the member's reference ({ id, name, status, updatedAt }) and need
// `X-Record-Version: <updatedAt>`, the version on screen: missing → 428,
// someone else saved since → 412 (nothing changed).

import { namedRefOf } from "@/lib/domain/named-records";
import { withApiRoute, type IdParams } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { expectedVersion } from "@/lib/server/http/versioning";
import { archiveTeamMember, changeTeamMember, getTeamMember } from "@/lib/server/team/service";

export const GET = withApiRoute<IdParams>({}, async ({ params }) => jsonOk({ member: await getTeamMember(params.id) }));

export const PATCH = withApiRoute<IdParams>({ body: true }, async ({ request, params, body }) =>
  jsonOk({ member: namedRefOf(await changeTeamMember(params.id, body, expectedVersion(request))) })
);

export const DELETE = withApiRoute<IdParams>({ sameOrigin: true }, async ({ request, params }) =>
  jsonOk({ member: namedRefOf(await archiveTeamMember(params.id, expectedVersion(request))) })
);

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
