// components/bookings/history-bill-actions.tsx
// A history row's own bill: preview in a new tab, and download.

"use client";

import { Download, Eye } from "lucide-react";
import { IconAction } from "@/components/shared/icon-action";
import type { Booking } from "@/lib/domain/types";
import { useBillPdf } from "@/hooks/use-bill-pdf";

export function HistoryBillActions({ booking, entryId, day }: { booking: Pick<Booking, "bookingId" | "invoiceNumber">; entryId: string; day: string }) {
  const bill = useBillPdf(booking, entryId);

  return (
    <span className="inline-flex gap-1">
      <IconAction label={`Preview the bill of ${day} in a new tab`} tooltip="Preview in a new tab" onClick={bill.preview}>
        <Eye />
      </IconAction>
      <IconAction label={`Download the bill of ${day}`} tooltip="Download" pending={bill.pending} onClick={() => void bill.download()}>
        <Download />
      </IconAction>
    </span>
  );
}
