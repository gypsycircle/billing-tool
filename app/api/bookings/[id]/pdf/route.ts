// app/api/bookings/[id]/pdf/route.ts
// GET /api/bookings/[id]/pdf — the Bill of Supply for the latest saved booking.
//   ?inline=1  open in the browser's PDF viewer instead of downloading
// No `export const runtime` — Node.js is the default (needed to read the template).

import { getBillOfSupply } from "@/lib/server/bookings/service";
import { withApiRoute } from "@/lib/server/http/route";
import { methodNotAllowed } from "@/lib/server/http/respond";

type Params = { id: string };

/** Invoice numbers allow / (e.g. GC/2026/7): keep the file name to safe characters. */
function fileName(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `Bill-of-Supply-${safe || "invoice"}.pdf`;
}

export const GET = withApiRoute<Params>({}, async ({ request, params }) => {
  const { pdf, invoiceNumber } = await getBillOfSupply(params.id);
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName(invoiceNumber)}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PUT = methodNotAllowed;
