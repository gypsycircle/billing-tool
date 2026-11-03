// hooks/use-bill-pdf.ts
// Download or preview a booking's Bill of Supply PDF: the latest, or with an
// `entryId` the one saved in that row of its history.
//   download(): fetches the PDF and saves it, with progress and error toasts
//               (the server's message, e.g. a field too long for the bill);
//               once at a time (useSingleFlight)
//   preview():  opens the PDF in the browser's viewer in a new tab

"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { apiFetchFile } from "@/lib/client/api-client";
import { routes } from "@/lib/domain/routes";
import type { Booking } from "@/lib/domain/types";
import { useSingleFlight } from "./use-single-flight";

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

export function useBillPdf(booking: Pick<Booking, "bookingId" | "invoiceNumber">, entryId?: string) {
  const url = entryId ? routes.api.historyBill(booking.bookingId, entryId) : routes.api.bill(booking.bookingId);
  const label = `No. ${booking.invoiceNumber}`;

  const { run: download, pending } = useSingleFlight(async () => {
    const toastId = toast.loading(`Preparing bill ${label}…`);
    const file = await apiFetchFile(url);
    if ("blob" in file) {
      save(file.blob, file.fileName ?? "Bill-of-Supply.pdf");
      toast.success(`Bill ${label} downloaded`, { id: toastId });
    } else if (file.status === 401) {
      toast.dismiss(toastId); // signing in again
    } else {
      // 422: a saved value doesn't fit the bill (e.g. changed outside the app)
      // A history row's bill can't be changed by editing, so it gets no such hint
      const description = file.status === 422 && !entryId ? "Edit the booking to fix it, then download again." : undefined;
      toast.error(file.error, { id: toastId, description });
    }
  });

  const preview = useCallback(() => {
    window.open(`${url}?inline=1`, "_blank", "noopener");
  }, [url]);

  return { download, preview, pending };
}
