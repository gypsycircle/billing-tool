// app/api/general/route.ts
// GET  /api/general — one list, ?kind=destination|package|route|marketing, active first,
//                     then by name: { items }. No or an unknown kind → 422.
// POST /api/general — add an item { kind, name }; answers its reference (201). A name
//                     already in that list → 409.
//
// Creates honour an `Idempotency-Key` header: a retry or double submit gets
// the first result.

import { parseGeneralListQuery } from "@/lib/domain/general.schema";
import { namedRefOf } from "@/lib/domain/named-records";
import { createGeneralItem, getGeneralList } from "@/lib/server/general/service";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { idempotencyKeyOf } from "@/lib/server/http/versioning";

export const GET = withApiRoute({}, async ({ query }) => jsonOk({ items: await getGeneralList(parseGeneralListQuery(query)) }));

export const POST = withApiRoute({ body: true }, async ({ request, body }) =>
  jsonOk({ item: namedRefOf(await createGeneralItem(body, idempotencyKeyOf(request))) }, 201)
);

export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
