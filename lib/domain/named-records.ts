// lib/domain/named-records.ts
// What team members and list items share: a name that must be unique (in its
// list), an Active / Archived status, and timestamps. Archived ones drop out
// of every dropdown but stay on the records that already use them.

import type { ArchivableStatus } from "./records";

export interface NamedRecord {
  id: string;
  name: string;
  status: ArchivableStatus;
  createdAt: string;
  updatedAt: string;
}

/** Rows per page of a Settings list (the team, each list). */
export const NAMED_PAGE_SIZE = 5;

/** The key two names are the same by: trimmed, case and inner spaces ignored ("Goa " = "goa"). */
export const nameKeyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** One dropdown choice: the record's ID, its name, and an optional second line ("Guide"). */
export interface NamedOption {
  id: string;
  name: string;
  detail?: string;
}

/** What a write returns: enough to show the change and keep editing it. */
export type NamedRef = Pick<NamedRecord, "id" | "name" | "status" | "updatedAt">;

export function namedRefOf({ id, name, status, updatedAt }: NamedRef): NamedRef {
  return { id, name, status, updatedAt };
}
