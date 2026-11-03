// hooks/use-record-dialog.ts
// The add / edit dialog of a Settings list (team members, list items): closed,
// adding (also on the list's shortcut), or editing one record; and where its
// save goes (a create, or an edit at the version on screen).

"use client";

import { useState } from "react";
import type { NamedRecord } from "@/lib/domain/named-records";
import type { SaveTarget } from "./use-save-record";
import { useShortcut } from "./use-shortcut";

export function useRecordDialog<Rec extends NamedRecord>({ shortcut, api }: { shortcut: string; api: { list: string; one: (id: string) => string } }) {
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  const openNew = () => setEditing("new");
  useShortcut(shortcut, openNew);
  /** The record being edited, or null while adding (or closed). */
  const record = editing === "new" ? null : editing;
  const target: SaveTarget = record ? { mode: "edit", url: api.one(record.id), version: record.updatedAt } : { mode: "create", url: api.list };

  return {
    record,
    openNew,
    openEdit: (rec: Rec) => setEditing(rec),
    /** RecordDialog's open state and save target. */
    dialog: { open: editing !== null, onOpenChange: (open: boolean) => !open && setEditing(null), target },
  };
}
