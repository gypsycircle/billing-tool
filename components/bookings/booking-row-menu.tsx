// components/bookings/booking-row-menu.tsx
// The "⋯" menu on each ledger row.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Ban, Download, Eye, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BookingActionTarget } from "@/lib/domain/types";
import { useBillPdf } from "@/hooks/use-bill-pdf";
import { useBookingActions } from "@/hooks/use-booking-actions";
import { ArchiveDialog } from "./archive-dialog";

export function BookingRowMenu({ booking }: { booking: BookingActionTarget }) {
  const router = useRouter();
  const actions = useBookingActions(booking);
  const bill = useBillPdf(booking);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const href = `/bookings/${booking.bookingId}`;
  const status = booking.bookingStatus;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for booking No. ${booking.invoiceNumber}`}
              className="text-muted-foreground hover:text-foreground"
              disabled={actions.pending}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(href)}>
              <Eye />
              Open
            </DropdownMenuItem>
            {status !== "Archived" && (
              <DropdownMenuItem onClick={() => router.push(`${href}/edit`)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
            )}
            {status !== "Archived" && (
              <DropdownMenuItem disabled={bill.pending} onClick={() => void bill.download()}>
                <Download />
                Download bill
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {status === "Active" && (
              <DropdownMenuItem onClick={() => void actions.cancel()}>
                <Ban />
                Mark cancelled
              </DropdownMenuItem>
            )}
            {status === "Cancelled" && (
              <DropdownMenuItem onClick={() => void actions.reactivate()}>
                <RotateCcw />
                Reactivate
              </DropdownMenuItem>
            )}
            {status === "Archived" ? (
              <DropdownMenuItem onClick={() => void actions.restore()}>
                <ArchiveRestore />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}>
                <Archive />
                Archive…
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        invoiceNumber={booking.invoiceNumber}
        customerName={booking.customerName}
        pending={actions.pending}
        onConfirm={() => actions.archive()}
      />
    </>
  );
}
