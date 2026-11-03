// components/shared/archive-dialog.tsx
// Confirms archiving a record. Financial records (bookings, expenses) are
// confirmed by typing their number; team members and list items with a
// click. Archiving hides it; it is kept and can be restored.

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

/** What the confirmation says about one record (the menus add the open state, pending and the action). */
export type ArchiveCopy = Pick<ArchiveDialogProps, "recordLabel" | "reference" | "typeToConfirm" | "description">;

/**
 * The confirmation for a numbered record (booking, expense): typed to confirm,
 * its own lead sentence, then the same promise for every record.
 */
export function numberedArchiveCopy(recordLabel: string, reference: string, lead: React.ReactNode): ArchiveCopy {
  return {
    recordLabel,
    reference,
    description: (
      <>
        {lead} Nothing is deleted — you can restore it from <span className="font-medium">Show archived</span>.
      </>
    ),
  };
}

interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "booking", "expense", "team member". */
  recordLabel: string;
  /** The record's number, typed to confirm (INV_…, EXP_…), or its name when there's nothing to type. */
  reference: string;
  /** Ask for the number to be typed (default). Off for records named, not numbered. */
  typeToConfirm?: boolean;
  /** What archiving does to this record, in a sentence or two. */
  description: React.ReactNode;
  pending: boolean;
  onConfirm: () => Promise<unknown>;
}

export function ArchiveDialog({ open, onOpenChange, recordLabel, reference, typeToConfirm = true, description, pending, onConfirm }: ArchiveDialogProps) {
  const [typed, setTyped] = useState("");
  const matches = !typeToConfirm || typed.trim() === reference;

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
          <AlertDialogTitle>
            {typeToConfirm ? `Archive ${recordLabel} No. ${reference}?` : `Archive ${recordLabel} “${reference}”?`}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {typeToConfirm && (
          <div className="space-y-1.5">
            <Label htmlFor="archive-confirm" className="text-[0.8125rem]">
              Type <span className="font-semibold tabular">{reference}</span> to confirm
            </Label>
            <Input
              id="archive-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-10 tabular"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep {recordLabel}</AlertDialogCancel>
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
