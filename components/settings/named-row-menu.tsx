// components/settings/named-row-menu.tsx
// The "⋯" on a team member's or list item's row: Edit (opens its dialog),
// Archive… (a plain confirmation) or Restore — versioned, like every record.

"use client";

import { RecordRowMenu } from "@/components/shared/record-menus";
import { useRecordActions } from "@/hooks/use-record-actions";
import type { NamedRecord } from "@/lib/domain/named-records";
import { isArchived } from "@/lib/domain/records";

export function NamedRowMenu({
  record,
  url,
  what,
  things,
  archiveDescription,
  onEdit,
}: {
  record: NamedRecord;
  /** routes.api.team.one(id), routes.api.general.one(id). */
  url: string;
  /** "team member", "destination". */
  what: string;
  /** The list's name, as its Filters name it: "team members", "destinations". */
  things: string;
  /** What archiving it means: which dropdown it leaves, and that it stays where it's used. */
  archiveDescription: string;
  onEdit: () => void;
}) {
  return (
    <RecordRowMenu
      label={`${what} ${record.name}`}
      onEdit={onEdit}
      archived={isArchived(record)}
      actions={useRecordActions({ url, version: record.updatedAt, title: record.name, findArchived: things })}
      copy={{ recordLabel: what, reference: record.name, typeToConfirm: false, description: archiveDescription }}
    />
  );
}
