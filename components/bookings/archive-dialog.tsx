// components/bookings/archive-dialog.tsx
// Confirms archiving by typing the invoice number. Archiving hides the booking
// from the ledger; the booking is kept and can be restored.

"use client";

import { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ArchiveDialog({
  open,
  onOpenChange,
  invoiceNumber,
  customerName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  customerName: string;
  pending: boolean;
  onConfirm: () => Promise<unknown>;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === invoiceNumber;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-medium">
            Archive booking No. {invoiceNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {customerName}&apos;s booking will be hidden from the ledger. Nothing is deleted — the booking is kept
            and you can restore it from <span className="font-medium">Show archived</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="archive-confirm" className="text-[0.8125rem]">
            Type <span className="font-semibold tabular">{invoiceNumber}</span> to confirm
          </Label>
          <Input
            id="archive-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="h-10 tabular"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!matches || pending}
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
              setTyped("");
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Archive />}
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
