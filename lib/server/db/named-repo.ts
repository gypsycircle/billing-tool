// lib/server/db/named-repo.ts
// Persistence for named records: team members (users) and list items
// (general). They share everything but their extra fields, so one repository
// serves both: reads, the dropdown options, the Settings list (paged), idempotent
// inserts, versioned edits, and archive / restore. `scope` narrows a
// collection to one list (general's { kind }); team members have none. The
// Settings list shows one status at a time (active, or the archived view), in
// each collection's own `order`, and can be searched on `searchFields`.
// No business rules here: those live in lib/server/records/named-service.ts.

import "server-only";

import type { Collection, Document, Filter, Sort } from "mongodb";
import type { PageInfo } from "@/lib/domain/filters";
import { NAMED_PAGE_SIZE, nameKeyOf, type NamedOption, type NamedRecord, type NamedRef } from "@/lib/domain/named-records";
import type { ArchivableStatus } from "@/lib/domain/records";
import type { NamedDoc } from "./collections";
import { isDuplicateKey } from "./duplicate-key";
import { clampPage } from "./paging";
import { searchAny } from "./search";

/** A full read: everything but the storage-only fields. */
const FULL = { nameKey: 0, idempotencyKey: 0 } as const satisfies Document;

/** Which Settings rows to show: one list (scope), active or archived, and an optional search. */
export interface NamedListView {
  scope?: Filter<NamedDoc>;
  archived: boolean;
  q?: string;
}

export function namedRepo<Rec extends NamedRecord, Doc extends NamedDoc>(options: {
  collection: () => Promise<Collection<Doc>>;
  toDoc: (record: Rec, idempotencyKey?: string) => Doc;
  fromDoc: (doc: Doc) => Rec;
  /** The Settings list's order within a status (an index must serve it, after the scope and status). */
  order: Readonly<Record<string, 1 | -1>>;
  /** The fields the Settings search looks in (none: no search). */
  searchFields?: readonly (keyof Doc & string)[];
  /** The fields the dropdown shows beside the name, and how they become its second line. */
  optionDetail?: { fields: readonly (keyof Doc & string)[]; of: (doc: Partial<Doc>) => string | undefined };
  /** Thrown when the name is already used (in that list). */
  duplicateName: (record: Rec) => Error;
}) {
  const { toDoc, fromDoc, order, searchFields = [], optionDetail, duplicateName } = options;
  /** The API's whole list: active first, then in order. */
  const listOrder: Sort = { status: 1, ...order };
  // The driver's generics don't follow a generic document type; every filter here only uses NamedDoc's fields
  const collection = async () => (await options.collection()) as unknown as Collection<NamedDoc>;
  const asRec = (doc: NamedDoc | null) => (doc ? fromDoc(doc as Doc) : null);

  async function findByIdempotencyKey(idempotencyKey: string): Promise<Rec | null> {
    return asRec(await (await collection()).findOne({ idempotencyKey }, { projection: FULL }));
  }

  return {
    async find(id: string, scope: Filter<NamedDoc> = {}): Promise<Rec | null> {
      return asRec(await (await collection()).findOne({ ...scope, _id: id }, { projection: FULL }));
    },

    /** The record's current version (updatedAt), or null if there is no such record. */
    async findVersion(id: string, scope: Filter<NamedDoc> = {}): Promise<string | null> {
      const doc = await (await collection()).findOne({ ...scope, _id: id }, { projection: { _id: 0, updatedAt: 1 } });
      return doc ? doc.updatedAt.toISOString() : null;
    },

    /** Every record (in scope), for the API: active first, then in order. */
    async list(scope: Filter<NamedDoc> = {}): Promise<Rec[]> {
      const docs = await (await collection()).find(scope, { projection: FULL }).sort(listOrder).toArray();
      return docs.map((doc) => fromDoc(doc as Doc));
    },

    /**
     * One page of the Settings list: the active records (in scope), or the
     * archived ones, matching the search, in order, with the count of all
     * matches. A page past the end shows the last.
     */
    async page(page: number, { scope = {}, archived, q }: NamedListView): Promise<{ items: Rec[] } & PageInfo> {
      const coll = await collection();
      const filter: Filter<NamedDoc> = { ...scope, status: archived ? "Archived" : "Active" };
      if (q && searchFields.length > 0) filter.$or = searchAny(searchFields, q) as Filter<NamedDoc>[];
      const fetchPage = async (p: number) =>
        (await coll.find(filter, { projection: FULL }).sort(order).skip((p - 1) * NAMED_PAGE_SIZE).limit(NAMED_PAGE_SIZE).toArray()).map((doc) => fromDoc(doc as Doc));
      const [items, count] = await Promise.all([fetchPage(page), coll.countDocuments(filter)]);
      return clampPage(page, NAMED_PAGE_SIZE, items, count, fetchPage);
    },

    /** True when there is any record (in scope), whatever its status. */
    async exists(scope: Filter<NamedDoc> = {}): Promise<boolean> {
      return (await (await collection()).findOne(scope, { projection: { _id: 1 } })) !== null;
    },

    /** How many active records there are (in scope). */
    async activeCount(scope: Filter<NamedDoc> = {}): Promise<number> {
      return (await collection()).countDocuments({ ...scope, status: "Active" });
    },

    /** The dropdown: active records (in scope) by name, with only what the option shows. */
    async options(scope: Filter<NamedDoc> = {}): Promise<NamedOption[]> {
      const extra = Object.fromEntries((optionDetail?.fields ?? []).map((field) => [field, 1]));
      const docs = await (await collection())
        .find({ ...scope, status: "Active" }, { projection: { _id: 1, name: 1, ...extra } })
        .sort({ nameKey: 1 })
        .toArray();
      return docs.map((doc) => {
        const detail = optionDetail?.of(doc as Partial<Doc>);
        return { id: doc._id, name: doc.name, ...(detail ? { detail } : {}) };
      });
    },

    /** The active record (in scope) with this name (any case or spacing), or null. */
    async findActiveByName(name: string, scope: Filter<NamedDoc> = {}): Promise<Rec | null> {
      return asRec(await (await collection()).findOne({ ...scope, status: "Active", nameKey: nameKeyOf(name) }, { projection: FULL }));
    },

    findByIdempotencyKey,

    /**
     * Inserts a new record. A repeat of the same create (double submit,
     * retry) returns the first record; a name already in use is refused.
     */
    async insert(record: Rec, idempotencyKey?: string): Promise<Rec> {
      try {
        await (await collection()).insertOne(toDoc(record, idempotencyKey));
        return record;
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        if (idempotencyKey && err.keyPattern?.idempotencyKey) {
          const first = await findByIdempotencyKey(idempotencyKey);
          if (first) return first;
        }
        if (err.keyPattern?.nameKey) throw duplicateName(record);
        throw err;
      }
    },

    /**
     * Replaces the editable fields if the record is still active and at the
     * version the caller read. False when nothing matched — the caller tells why.
     */
    async updateIfVersion(record: Rec, expectedUpdatedAt: string): Promise<boolean> {
      const expected = new Date(expectedUpdatedAt);
      if (Number.isNaN(expected.getTime())) return false;
      const { _id, status, createdAt, idempotencyKey, ...editable } = toDoc(record);
      void status; void createdAt; void idempotencyKey;
      try {
        const result = await (await collection()).updateOne({ _id, updatedAt: expected, status: "Active" }, { $set: editable });
        return result.matchedCount === 1;
      } catch (err) {
        if (isDuplicateKey(err) && err.keyPattern?.nameKey) throw duplicateName(record);
        throw err;
      }
    },

    /** Archives or restores, if still at `expectedUpdatedAt`. Its new reference, or null when nothing matched. */
    async setStatusIfVersion(id: string, expectedUpdatedAt: string, status: ArchivableStatus, updatedAt: string): Promise<NamedRef | null> {
      const expected = new Date(expectedUpdatedAt);
      if (Number.isNaN(expected.getTime())) return null;
      const doc = await (await collection()).findOneAndUpdate(
        { _id: id, updatedAt: expected },
        { $set: { status, updatedAt: new Date(updatedAt) } },
        { returnDocument: "after", projection: { _id: 1, name: 1, status: 1, updatedAt: 1 } }
      );
      return doc ? { id: doc._id, name: doc.name, status: doc.status, updatedAt: doc.updatedAt.toISOString() } : null;
    },
  };
}

export type NamedRepo<Rec extends NamedRecord> = ReturnType<typeof namedRepo<Rec, NamedDoc>>;
