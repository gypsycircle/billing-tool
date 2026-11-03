// app/api/expenses/route.ts
// GET  /api/expenses — one page of the expenses list for the list's filters (?kind, type,
//                      paidFor, archived=1, from / to (expense date, YYYY-MM-DD),
//                      page): { items, count and total of every
//                      match, the Direct / Indirect tiles }.
// POST /api/expenses — create an expense; answers its reference (201).
//
// Creates honour an `Idempotency-Key` header: a retry or double submit gets
// the first result.

import { parseExpenseFilters } from "@/lib/domain/expense-filters";
import { expenseRefOf } from "@/lib/domain/expenses";
import { createExpense, getExpenseLedger } from "@/lib/server/expenses/service";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { idempotencyKeyOf } from "@/lib/server/http/versioning";

export const GET = withApiRoute({}, async ({ query }) => jsonOk(await getExpenseLedger(parseExpenseFilters(query))));

export const POST = withApiRoute({ body: true }, async ({ request, body }) =>
  jsonOk({ expense: expenseRefOf(await createExpense(body, idempotencyKeyOf(request))) }, 201)
);

export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
