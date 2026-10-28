// The MongoDB client heals itself: a failed first connect or a closed
// topology never leaves the server stuck on "Topology is closed" (as happened
// on Vercel after a cold start); the next call connects afresh.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server-core";

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGODB_URI: server.getUri(),
    MONGODB_DB: "client_test",
    SESSION_SECRET: "x".repeat(40),
    INITIAL_INVOICE_NUMBER: "143",
  });
}, 120_000);

afterAll(async () => {
  const { closeMongoClient } = await import("./client");
  await closeMongoClient();
  await server.stop();
});

describe("getDb", () => {
  it("reuses one connected client while it is healthy", async () => {
    const { getDb } = await import("./client");
    const [a, b] = await Promise.all([getDb(), getDb()]);
    expect(a.client).toBe(b.client);
    expect((await a.command({ ping: 1 })).ok).toBe(1);
  });

  it("connects afresh after the topology closes", async () => {
    const { getDb } = await import("./client");
    const before = (await getDb()).client;
    // What the driver does after a failed connect: close the topology but keep it attached
    (before as unknown as { topology: { close(): void } }).topology.close();
    const after = await getDb();
    expect(after.client).not.toBe(before);
    expect((await after.command({ ping: 1 })).ok).toBe(1);
  });

  it("recovers after a failed first connect once the database is back", async () => {
    const { closeMongoClient, getDb } = await import("./client");
    await closeMongoClient();
    await server.stop({ doCleanup: false, force: false });
    await expect(getDb()).rejects.toThrow(); // server selection fails (5 s)
    await server.start(true); // same port
    const db = await getDb();
    expect((await db.command({ ping: 1 })).ok).toBe(1);
  }, 30_000);
});
