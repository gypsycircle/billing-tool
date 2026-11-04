// components/shared/confirm-dialog.tsx
// Asks before an action that matters: a title, what it does, Cancel and the
// action. ArchiveDialog is built on it; `children` adds to the body.

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** It has finished opening or fading out. */
  onOpenChangeComplete?: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  /** The way out (default "Cancel"). */
  dismissLabel?: string;
  /** Shown on the action while it isn't running. */
  icon?: React.ReactNode;
  destructive?: boolean;
  /** The action can't be taken yet. */
  disabled?: boolean;
  pending: boolean;
  onConfirm: () => Promise<unknown>;
  children?: React.ReactNode;
}

export function ConfirmDialog({ open, onOpenChange, onOpenChangeComplete, title, description, confirmLabel, dismissLabel = "Cancel", icon, destructive, disabled, pending, onConfirm, children }: ConfirmDialogProps) {
  // Done: the action keeps its spinner while the dialog fades out
  const [done, setDone] = useState(false);
  const busy = pending || done;

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => {
        if (!next) setDone(false);
        onOpenChangeComplete?.(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{dismissLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={disabled || busy}
            onClick={async () => {
              await onConfirm();
              setDone(true);
              onOpenChange(false);
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : icon}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
