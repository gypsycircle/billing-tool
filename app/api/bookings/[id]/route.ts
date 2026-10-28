// app/api/bookings/[id]/route.ts
// GET    /api/bookings/[id] — one booking.
// PATCH  /api/bookings/[id] — either field changes, or a status change on its
//                             own: { "bookingStatus": "Active" | "Cancelled" }
//                             (cancel, reactivate, or restore from archive).
// DELETE /api/bookings/[id] — archive (soft delete; the booking stays in the database).
//
// PATCH and DELETE return the booking's reference ({ bookingId, invoiceNumber,
// updatedAt, bookingStatus }) and require `X-Booking-Version: <updatedAt>` —
// the version the user was looking at. Missing → 428; someone else saved
// since → 412 (nothing changed).

import { statusChangeSchema } from "@/lib/domain/booking.schema";
import { BOOKING_VERSION_HEADER, bookingRefOf } from "@/lib/domain/types";
import {
  archiveBooking,
  getBooking,
  setBookingStatus,
  updateBooking,
} from "@/lib/server/bookings/service";
import { withApiRoute } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { readJsonBody } from "@/lib/server/security/body";

type Params = { id: string };

/** The version the client is changing ("" if absent or malformed). */
function expectedVersion(request: Request): string {
  const value = request.headers.get(BOOKING_VERSION_HEADER)?.trim() ?? "";
  return value.length <= 64 ? value : "";
}

export const GET = withApiRoute<Params>({}, async ({ params }) =>
  jsonOk({ booking: await getBooking(params.id) })
);

export const PATCH = withApiRoute<Params>({ sameOrigin: true, json: true }, async ({ request, params }) => {
  const { data, error } = await readJsonBody(request);
  if (error) return error;

  const version = expectedVersion(request);
  const statusChange = statusChangeSchema.safeParse(data);
  const booking = statusChange.success
    ? await setBookingStatus(params.id, statusChange.data.bookingStatus, version)
    : await updateBooking(params.id, data, version);
  return jsonOk({ booking: bookingRefOf(booking) });
});

export const DELETE = withApiRoute<Params>({ sameOrigin: true }, async ({ request, params }) =>
  jsonOk({ booking: bookingRefOf(await archiveBooking(params.id, expectedVersion(request))) })
);

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
