// app/api/expenses/[id]/route.ts
// GET    /api/expenses/[id] — one expense.
// PATCH  /api/expenses/[id] — field changes, or { status: "Active" } on its own (restore).
// DELETE /api/expenses/[id] — archive (soft delete; the expense stays in the database).
//
// Writes answer with the expense's reference ({ expenseId, expenseNumber, updatedAt, status }) and need
// `X-Record-Version: <updatedAt>`, the version on screen: missing → 428,
// someone else saved since → 412 (nothing changed).

import { expenseRefOf } from "@/lib/domain/expenses";
import { archiveExpense, changeExpense, getExpense } from "@/lib/server/expenses/service";
import { withApiRoute, type IdParams } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { expectedVersion } from "@/lib/server/http/versioning";

export const GET = withApiRoute<IdParams>({}, async ({ params }) => jsonOk({ expense: await getExpense(params.id) }));

export const PATCH = withApiRoute<IdParams>({ body: true }, async ({ request, params, body }) =>
  jsonOk({ expense: expenseRefOf(await changeExpense(params.id, body, expectedVersion(request))) })
);

export const DELETE = withApiRoute<IdParams>({ sameOrigin: true }, async ({ request, params }) =>
  jsonOk({ expense: expenseRefOf(await archiveExpense(params.id, expectedVersion(request))) })
);

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
