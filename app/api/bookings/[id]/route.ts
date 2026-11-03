// app/api/bookings/[id]/route.ts
// GET    /api/bookings/[id] — one booking.
// PATCH  /api/bookings/[id] — field changes, or { bookingStatus: "Active" | "Cancelled" } on
//                             its own (cancel, reactivate, or restore from archive).
// DELETE /api/bookings/[id] — archive (soft delete; the booking stays in the database).
//
// Writes answer with the booking's reference ({ bookingId, invoiceNumber, updatedAt, bookingStatus }) and need
// `X-Record-Version: <updatedAt>`, the version on screen: missing → 428,
// someone else saved since → 412 (nothing changed).

import { bookingRefOf } from "@/lib/domain/types";
import { archiveBooking, changeBooking, getBooking } from "@/lib/server/bookings/service";
import { withApiRoute, type IdParams } from "@/lib/server/http/route";
import { jsonOk, methodNotAllowed } from "@/lib/server/http/respond";
import { expectedVersion } from "@/lib/server/http/versioning";

export const GET = withApiRoute<IdParams>({}, async ({ params }) => jsonOk({ booking: await getBooking(params.id) }));

export const PATCH = withApiRoute<IdParams>({ body: true }, async ({ request, params, body }) =>
  jsonOk({ booking: bookingRefOf(await changeBooking(params.id, body, expectedVersion(request))) })
);

export const DELETE = withApiRoute<IdParams>({ sameOrigin: true }, async ({ request, params }) =>
  jsonOk({ booking: bookingRefOf(await archiveBooking(params.id, expectedVersion(request))) })
);

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
