// lib/server/db/test-database.ts
// For database tests: a real in-memory MongoDB, run as a one-node replica set
// (as Atlas is) so transactions work. Each test file gets its own.
//   const db = setUpTestDatabase("billing_test");   // at the top of the file
//   beforeEach(db.clear);

import { afterAll, beforeAll } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

const COLLECTIONS = ["bookings", "counters", "rate_limits", "settings", "payments", "expenses", "users", "general"];

export function setUpTestDatabase(name: string) {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    Object.assign(process.env, {
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: name,
      SESSION_SECRET: "x".repeat(40),
      INITIAL_INVOICE_NUMBER: "143",
    });
  }, 120_000);

  afterAll(async () => {
    const { closeMongoClient } = await import("./client");
    await closeMongoClient();
    await replSet.stop();
  });

  return {
    /** Empties every collection (indexes and validators stay). */
    async clear() {
      const { getDb } = await import("./client");
      const { ensureDatabase } = await import("./collections");
      await ensureDatabase();
      const db = await getDb();
      await Promise.all(COLLECTIONS.map((collection) => db.collection(collection).deleteMany({})));
    },
  };
}

/** Every `stage` named anywhere in an explain() result (for query-plan checks). */
export function stagesOf(plan: unknown, found: string[] = []): string[] {
  if (Array.isArray(plan)) plan.forEach((p) => stagesOf(p, found));
  else if (plan && typeof plan === "object") {
    for (const [key, value] of Object.entries(plan)) {
      if (key === "stage" && typeof value === "string") found.push(value);
      else if (key !== "rejectedPlans") stagesOf(value, found);
    }
  }
  return found;
}
