// components/shared/record-menus.tsx
// A record's action menus (bookings, expenses, team members, list items):
//   RecordRowMenu       the "⋯" on a list row: Open and Edit (or Edit alone, in
//                       a dialog), then Archive… or Restore
//   (RecordMoreMenu     the "More" button on a record's page: Archive… or Restore)
//   RecordDetailActions a record page's header actions: Edit, the record's own
//                       buttons (children), then More
// Archive and restore run through the record's actions (useRecordActions);
// archiving is confirmed first (by typing the number, for bookings and expenses).

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ChevronDown, Eye, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RecordActions } from "@/hooks/use-record-actions";
import { ArchiveDialog, type ArchiveCopy } from "./archive-dialog";

interface StatusProps {
  archived: boolean;
  /** The record's archive / restore (useRecordActions or a record's own hook built on it). */
  actions: Pick<RecordActions, "pending" | "restore" | "archive">;
  /** What the archive confirmation says. */
  copy: ArchiveCopy;
  /** More items before Archive / Restore. */
  statusItems?: React.ReactNode;
}

/** The record's own status items, then Archive… (opens the confirmation) or Restore. */
function StatusItems({ archived, actions, onArchive, statusItems }: Pick<StatusProps, "archived" | "actions" | "statusItems"> & { onArchive: () => void }) {
  return (
    <DropdownMenuGroup>
      {statusItems}
      {archived ? (
        <DropdownMenuItem onClick={() => void actions.restore()}>
          <ArchiveRestore />
          Restore
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem variant="destructive" onClick={onArchive}>
          <Archive />
          Archive…
        </DropdownMenuItem>
      )}
    </DropdownMenuGroup>
  );
}

/** The confirmation, wired to the record's archive. */
function Confirm({ actions, copy, open, onOpenChange }: Pick<StatusProps, "actions" | "copy"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <ArchiveDialog {...copy} open={open} onOpenChange={onOpenChange} pending={actions.pending} onConfirm={() => actions.archive()} />;
}

export function RecordRowMenu({
  label,
  href,
  editHref,
  onEdit,
  openItems,
  ...status
}: StatusProps & {
  /** Names the record for screen readers: "booking No. INV_…". */
  label: string;
  /** The record's page (Open). */
  href?: string;
  /** Its edit page (Edit), unless `onEdit` is given. */
  editHref?: string;
  /** Edit without a page (e.g. opens a dialog). */
  onEdit?: () => void;
  /** More items after Open / Edit (hidden for archived records by the caller). */
  openItems?: React.ReactNode;
}) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${label}`}
              className="text-muted-foreground hover:text-foreground"
              disabled={status.actions.pending}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {(href || !status.archived || openItems) && (
            <>
              <DropdownMenuGroup>
                {href && (
                  <DropdownMenuItem onClick={() => router.push(href)}>
                    <Eye />
                    Open
                  </DropdownMenuItem>
                )}
                {!status.archived && (
                  <DropdownMenuItem onClick={onEdit ?? (() => editHref && router.push(editHref))}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                )}
                {openItems}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <StatusItems {...status} onArchive={() => setArchiveOpen(true)} />
        </DropdownMenuContent>
      </DropdownMenu>

      <Confirm {...status} open={archiveOpen} onOpenChange={setArchiveOpen} />
    </>
  );
}

/** The "More" button in a record page's header. */
function RecordMoreMenu(status: StatusProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="lg" aria-label="More actions" disabled={status.actions.pending} />}>
          More
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <StatusItems {...status} onArchive={() => setArchiveOpen(true)} />
        </DropdownMenuContent>
      </DropdownMenu>

      <Confirm {...status} open={archiveOpen} onOpenChange={setArchiveOpen} />
    </>
  );
}

/**
 * A record page's header actions: Edit (while not archived), the record's own
 * buttons, then More. Archiving from here stays on the page, which then shows
 * the record archived (its notice, and Restore under More).
 */
export function RecordDetailActions({
  editHref,
  children,
  ...more
}: StatusProps & {
  editHref: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      {!more.archived && (
        <Button variant="outline" size="lg" nativeButton={false} render={<Link href={editHref} />}>
          <Pencil />
          Edit
        </Button>
      )}
      {children}
      <RecordMoreMenu {...more} />
    </>
  );
}
