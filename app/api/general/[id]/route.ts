// app/api/general/[id]/route.ts
// GET    /api/general/[id] — one list item.
// PATCH  /api/general/[id] — rename it ({ name }), or { status: "Active" } on its own (restore).
// DELETE /api/general/[id] — archive (hidden from its dropdown; kept on the bookings and
//                            expenses that already use it).
//
// Writes answer with the item's reference ({ id, name, status, updatedAt }) and need
// `X-Record-Version: <updatedAt>`, the version on screen: missing → 428,
// someone else saved since → 412 (nothing changed).

import { namedRefOf } from "@/lib/domain/named-records";
import { archiveGeneralItem, changeGeneralItem, getGeneralItem } from "@/lib/server/general/service";
import { withApiRoute, type IdParams } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { expectedVersion } from "@/lib/server/http/versioning";

export const GET = withApiRoute<IdParams>({}, async ({ params }) => jsonOk({ item: await getGeneralItem(params.id) }));

export const PATCH = withApiRoute<IdParams>({ body: true }, async ({ request, params, body }) =>
  jsonOk({ item: namedRefOf(await changeGeneralItem(params.id, body, expectedVersion(request))) })
);

export const DELETE = withApiRoute<IdParams>({ sameOrigin: true }, async ({ request, params }) =>
  jsonOk({ item: namedRefOf(await archiveGeneralItem(params.id, expectedVersion(request))) })
);

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
