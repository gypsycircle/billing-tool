// lib/server/records/named-service.ts
// The rules team members and list items share, on top of their repository:
// every call verifies the session; creates are validated and idempotent;
// edits merge onto the stored record, are re-validated, and only land if the
// record is still at the version the user saw (archived ones are read-only);
// archive and restore are versioned too; a PATCH is a restore on its own or an
// edit (change). Each service supplies its schemas.

import "server-only";

import { restoreSchema } from "@/lib/domain/field-rules";
import type { NamedRecord, NamedRef } from "@/lib/domain/named-records";
import { isArchived } from "@/lib/domain/records";
import type { ArchivableStatus } from "@/lib/domain/records";
import type { z } from "zod";
import type { NamedRepo } from "../db/named-repo";
import { ArchivedRecordError, NotFoundError, type RecordName } from "../errors";
import { verifySession } from "../guards";
import { assertCurrentVersion, assertRecordId, assertVersionFor, nextTimestamp, notWritten, onePerKey, statusOrEdit } from "./rules";

export function namedService<Rec extends NamedRecord>(options: {
  record: RecordName;
  repo: NamedRepo<Rec>;
  idSchema: z.ZodType;
  /** A new record from the request body (validated), without its ID, status or timestamps. */
  draftOf: (input: unknown) => Promise<Omit<Rec, keyof NamedRecord> & Pick<NamedRecord, "name">> | (Omit<Rec, keyof NamedRecord> & Pick<NamedRecord, "name">);
  /** The record after an edit (validated), from the stored one and the request body. */
  edited: (current: Rec, input: unknown) => Promise<Rec> | Rec;
}) {
  const { record, repo, idSchema, draftOf, edited } = options;
  const assertId = (id: string) => assertRecordId(record, idSchema, id);
  const oneCreatePerKey = onePerKey<Rec>();

  const versionOf = (id: string) => () => repo.findVersion(id);

  async function setStatus(id: string, status: ArchivableStatus, expectedUpdatedAt: string): Promise<NamedRef> {
    await verifySession();
    assertId(id);
    await assertVersionFor(record, expectedUpdatedAt, versionOf(id));
    return (await repo.setStatusIfVersion(id, expectedUpdatedAt, status, nextTimestamp(expectedUpdatedAt))) ?? notWritten(record, versionOf(id));
  }

  /** Edits a record at the version the user saw (X-Record-Version). */
  async function update(id: string, input: unknown, expectedUpdatedAt: string): Promise<Rec> {
    await verifySession();
    assertId(id);
    const current = await repo.find(id);
    if (!current) throw new NotFoundError(record); // before the version: an unknown record is 404, not 428
    assertCurrentVersion(record, current.updatedAt, expectedUpdatedAt);
    if (isArchived(current)) throw new ArchivedRecordError(record);

    const updated = { ...(await edited(current, input)), updatedAt: nextTimestamp(current.updatedAt) };
    return (await repo.updateIfVersion(updated, expectedUpdatedAt)) ? updated : notWritten(record, versionOf(id));
  }

  return {
    async get(id: string): Promise<Rec> {
      await verifySession();
      assertId(id);
      const found = await repo.find(id);
      if (!found) throw new NotFoundError(record);
      return found;
    },

    /** Creates a record; a repeat with the same idempotency key returns the first. A name in use is 409. */
    async create(input: unknown, idempotencyKey?: string): Promise<Rec> {
      await verifySession();
      const draft = await draftOf(input);
      return oneCreatePerKey(idempotencyKey, async () => {
        const earlier = idempotencyKey ? await repo.findByIdempotencyKey(idempotencyKey) : null;
        if (earlier) return earlier;
        const now = new Date().toISOString();
        return repo.insert({ ...draft, id: crypto.randomUUID(), status: "Active", createdAt: now, updatedAt: now } as Rec, idempotencyKey);
      });
    },

    update,
    setStatus,

    /** A PATCH: { status: "Active" } on its own restores; anything else is an edit. */
    change: (id: string, input: unknown, expectedUpdatedAt: string): Promise<NamedRef> =>
      statusOrEdit(input, restoreSchema, {
        status: ({ status }) => setStatus(id, status, expectedUpdatedAt),
        edit: (changes) => update(id, changes, expectedUpdatedAt),
      }),

    /** Archives: hidden from every dropdown, kept on what already uses it, restorable. */
    archive: (id: string, expectedUpdatedAt: string) => setStatus(id, "Archived", expectedUpdatedAt),
  };
}
