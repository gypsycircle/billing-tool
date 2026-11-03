// lib/server/db/counters-repo.ts
// Yearly number sequences (invoice numbers, expense numbers), one document
// per sequence and year in `counters`: { _id: "<sequence>:<year>", seq }.

import "server-only";

import { countersCollection } from "./collections";

export type Sequence = "invoice" | "expense";

const counterId = (sequence: Sequence, year: number) => `${sequence}:${year}`;

/** The year's last issued number, or null if none yet. Read-only (for a form's preview). */
export async function peekSequence(sequence: Sequence, year: number): Promise<number | null> {
  const doc = await (await countersCollection()).findOne({ _id: counterId(sequence, year) }, { projection: { _id: 0, seq: 1 } });
  return doc ? doc.seq : null;
}

/**
 * Atomically issues the year's next number: `firstNumber` for the year's
 * first, then +1 each time. Concurrent calls always get distinct numbers.
 */
export async function issueSequence(sequence: Sequence, year: number, firstNumber: number): Promise<number> {
  const doc = await (await countersCollection()).findOneAndUpdate(
    { _id: counterId(sequence, year) },
    [{ $set: { seq: { $add: [{ $ifNull: ["$seq", firstNumber - 1] }, 1] } } }],
    { upsert: true, returnDocument: "after", projection: { _id: 0, seq: 1 } }
  );
  if (!doc) throw new Error(`${sequence} counter update returned nothing`);
  return doc.seq;
}
