// app/api/bookings/[id]/history/[entryId]/pdf/route.ts
// GET /api/bookings/[id]/history/[entryId]/pdf — the Bill of Supply as it stood at that
//     point in the booking's history, as a download; ?inline=1 opens it in the browser's
//     PDF viewer. Unknown entry → 404; archived bookings → 409; a bill that no longer fits → 422.

import { parseBillQuery } from "@/lib/domain/booking.schema";
import { getHistoryBill } from "@/lib/server/bookings/service";
import { withApiRoute, type IdParams } from "@/lib/server/http/route";
import { fileResponse, methodNotAllowed } from "@/lib/server/http/respond";

export const GET = withApiRoute<IdParams & { entryId: string }>({}, async ({ params, query }) =>
  fileResponse({ ...(await getHistoryBill(params.id, params.entryId)), ...parseBillQuery(query) })
);

export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
