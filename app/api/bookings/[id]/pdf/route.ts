// app/api/bookings/[id]/pdf/route.ts
// GET /api/bookings/[id]/pdf — the Bill of Supply for the latest saved booking, as a
//                             download; ?inline=1 opens it in the browser's PDF viewer.
//                             Archived bookings → 409; a bill that no longer fits → 422.

import { parseBillQuery } from "@/lib/domain/booking.schema";
import { getBillOfSupply } from "@/lib/server/bookings/service";
import { withApiRoute, type IdParams } from "@/lib/server/http/route";
import { fileResponse, methodNotAllowed } from "@/lib/server/http/respond";

export const GET = withApiRoute<IdParams>({}, async ({ params, query }) =>
  fileResponse({ ...(await getBillOfSupply(params.id)), ...parseBillQuery(query) })
);

export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
