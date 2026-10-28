// app/api/bookings/route.ts
// GET  /api/bookings — one page of the ledger: the same filters as the
//                      dashboard (?q, destination, payment, status, archived=1,
//                      due, page), with the count and totals of every match,
//                      the summary figures and the destination list.
// POST /api/bookings — create a booking; returns its reference. An optional
//                      Idempotency-Key header makes retries/double-submits
//                      return the first result.

import { parseBookingFilters } from "@/lib/domain/filters";
import { bookingRefOf } from "@/lib/domain/types";
import { createBooking, getLedger } from "@/lib/server/bookings/service";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { readJsonBody } from "@/lib/server/security/body";

/** Client-chosen key that makes a create safe to retry (letters, digits and -, 16–64 long). */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{16,64}$/;

export const GET = withApiRoute({}, async ({ request }) => {
  const params = new URL(request.url).searchParams;
  return jsonOk(await getLedger(parseBookingFilters(Object.fromEntries(params))));
});

export const POST = withApiRoute({ sameOrigin: true, json: true }, async ({ request }) => {
  const { data, error } = await readJsonBody(request);
  if (error) return error;

  const key = request.headers.get("idempotency-key") ?? "";
  const booking = await createBooking(data, IDEMPOTENCY_KEY.test(key) ? key : undefined);
  return jsonOk({ booking: bookingRefOf(booking) }, 201);
});

export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
