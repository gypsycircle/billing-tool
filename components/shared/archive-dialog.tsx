// components/shared/archive-dialog.tsx
// Confirms archiving a record. Financial records (bookings, expenses) are
// confirmed by typing their number; team members and list items with a
// click. Archiving hides it; it is kept and can be restored.

"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "./confirm-dialog";

/** What the confirmation says about one record (the menus add the open state, pending and the action). */
export type ArchiveCopy = Pick<ArchiveDialogProps, "recordLabel" | "reference" | "typeToConfirm" | "description">;

interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "booking", "expense", "team member". */
  recordLabel: string;
  /** The record's number, typed to confirm (INV_…, EXP_…), or its name when there's nothing to type. */
  reference: string;
  /** Ask for the number to be typed (default). Off for records named, not numbered. */
  typeToConfirm?: boolean;
  /** What archiving does to this record, in one short sentence. Where to restore it from is added after it. */
  description: React.ReactNode;
  pending: boolean;
  onConfirm: () => Promise<unknown>;
}

export function ArchiveDialog({ open, onOpenChange, recordLabel, reference, typeToConfirm = true, description, pending, onConfirm }: ArchiveDialogProps) {
  const [typed, setTyped] = useState("");
  const matches = !typeToConfirm || typed.trim() === reference;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => {
        if (!next) setTyped("");
      }}
      title={typeToConfirm ? `Archive ${recordLabel} No. ${reference}?` : `Archive ${recordLabel} “${reference}”?`}
      description={
        <>
          {description} You can restore {recordLabel === "team member" ? "them" : "it"} from Filters.
        </>
      }
      confirmLabel="Archive"
      dismissLabel={`Keep ${recordLabel}`}
      icon={<Archive />}
      destructive
      disabled={!matches}
      pending={pending}
      onConfirm={onConfirm}
    >
      {typeToConfirm && (
        <div className="space-y-1.5">
          <Label htmlFor="archive-confirm" className="text-[0.8125rem]">
            {/* One piece: the label spaces its children apart */}
            <span>
              Type <span className="font-semibold tabular">{reference}</span> to confirm
            </span>
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
    </ConfirmDialog>
  );
}
