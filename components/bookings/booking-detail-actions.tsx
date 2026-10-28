// components/bookings/booking-detail-actions.tsx
// Actions in the booking detail header: Edit, the Bill of Supply (preview and
// download, shortcut D), and a menu for cancel / reactivate / archive / restore.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Ban, ChevronDown, Download, Eye, Loader2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BookingActionTarget } from "@/lib/domain/types";
import { useBillPdf } from "@/hooks/use-bill-pdf";
import { useBookingActions } from "@/hooks/use-booking-actions";
import { useHotkey } from "@/hooks/use-hotkey";
import { ArchiveDialog } from "./archive-dialog";

interface BookingDetailActionsProps {
  booking: BookingActionTarget;
  /** False when a value doesn't fit the bill (the page explains which). */
  printable: boolean;
}

export function BookingDetailActions({ booking, printable }: BookingDetailActionsProps) {
  const router = useRouter();
  const actions = useBookingActions(booking);
  const bill = useBillPdf(booking);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const status = booking.bookingStatus;
  const hasBill = status !== "Archived";
  const canPrint = hasBill && printable;

  useHotkey("d", () => void bill.download(), { enabled: canPrint && !archiveOpen });

  return (
    <>
      {status !== "Archived" && (
        <Button variant="outline" size="lg" nativeButton={false} render={<Link href={`/bookings/${booking.bookingId}/edit`} />}>
          <Pencil />
          Edit
        </Button>
      )}

      {hasBill && (
        <>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Preview the Bill of Supply in a new tab"
                  disabled={!canPrint}
                  onClick={bill.preview}
                />
              }
            >
              <Eye />
            </TooltipTrigger>
            <TooltipContent>Preview in a new tab</TooltipContent>
          </Tooltip>

          <Button size="lg" disabled={!canPrint || bill.pending} onClick={() => void bill.download()}>
            {bill.pending ? <Loader2 className="animate-spin" /> : <Download />}
            Bill of Supply
            <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex">D</Kbd>
          </Button>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="lg" aria-label="More actions" disabled={actions.pending} />}
        >
          More
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
        onConfirm={() => actions.archive(() => router.push("/bookings"))}
      />
    </>
  );
}
