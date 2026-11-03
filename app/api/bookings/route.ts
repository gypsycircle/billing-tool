// app/api/bookings/route.ts
// GET  /api/bookings — one page of the ledger for the ledger's filters (?q, destination,
//                      payment, status, archived=1, due, from / to (trip start,
//                      YYYY-MM-DD), booked (invoice date, YYYY-MM-DD), page): { items, count and totals
//                      of every match, summary figures, destinations }.
// POST /api/bookings — create a booking; answers its reference (201).
//
// Creates honour an `Idempotency-Key` header: a retry or double submit gets
// the first result.

import { parseBookingFilters } from "@/lib/domain/filters";
import { bookingRefOf } from "@/lib/domain/types";
import { createBooking, getBookingLedger } from "@/lib/server/bookings/service";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { idempotencyKeyOf } from "@/lib/server/http/versioning";

export const GET = withApiRoute({}, async ({ query }) => jsonOk(await getBookingLedger(parseBookingFilters(query))));

export const POST = withApiRoute({ body: true }, async ({ request, body }) =>
  jsonOk({ booking: bookingRefOf(await createBooking(body, idempotencyKeyOf(request))) }, 201)
);

export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
