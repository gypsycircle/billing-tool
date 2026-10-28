// hooks/use-bill-pdf.ts
// Download or preview a booking's Bill of Supply PDF.
//   download(): fetches the PDF and saves it, with progress and error toasts
//               (the server's message, e.g. a field too long for the bill)
//   preview():  opens the PDF in the browser's viewer in a new tab

"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { redirectToSignIn } from "@/lib/client/api-client";
import type { Booking } from "@/lib/domain/types";

/** filename="…" from a Content-Disposition header. */
function fileNameFrom(header: string | null): string | null {
  return header?.match(/filename="([^"]+)"/)?.[1] ?? null;
}

function save(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function useBillPdf(booking: Pick<Booking, "bookingId" | "invoiceNumber">) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const url = `/api/bookings/${booking.bookingId}/pdf`;
  const label = `No. ${booking.invoiceNumber}`;

  const download = useCallback(async () => {
    if (inFlight.current) return; // ignore double clicks
    inFlight.current = true;
    setPending(true);
    const toastId = toast.loading(`Preparing bill ${label}…`);
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (response.status === 401) {
        toast.dismiss(toastId);
        redirectToSignIn();
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = typeof body?.error === "string" ? body.error : `The bill couldn't be prepared (${response.status}).`;
        // 422: a saved value doesn't fit the bill (e.g. changed outside the app)
        const description = response.status === 422 ? "Edit the booking to fix it, then download again." : undefined;
        toast.error(message, { id: toastId, description });
        return;
      }
      save(await response.blob(), fileNameFrom(response.headers.get("Content-Disposition")) ?? "Bill-of-Supply.pdf");
      toast.success(`Bill ${label} downloaded`, { id: toastId });
    } catch {
      toast.error("Network error. Please check your connection and try again.", { id: toastId });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [url, label]);

  const preview = useCallback(() => {
    window.open(`${url}?inline=1`, "_blank", "noopener");
  }, [url]);

  return { download, preview, pending };
}
