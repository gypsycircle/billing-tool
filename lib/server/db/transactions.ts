// lib/server/db/transactions.ts
// Several writes that must all happen or none (a booking change and its
// payment entry). MongoDB retries the whole callback on a transient error,
// so callbacks only write, through the given session.

import "server-only";

import type { ClientSession } from "mongodb";
import { getDb } from "./client";

export async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = (await getDb()).client.startSession();
  try {
    return await session.withTransaction(work, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }
}
