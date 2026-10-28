// lib/server/db/client.ts
// One MongoDB client per server instance. Kept on globalThis so warm Vercel
// invocations and dev hot-reloads reuse the same connection pool instead of
// opening new connections on every request.
//
// Self-healing: when the driver's first connect fails, it closes its topology
// but keeps it attached, so every later operation on that client fails with
// "Topology is closed" for good. A client whose connect fails, or whose
// topology closes later, is therefore dropped from the cache, and the next
// request builds a fresh one.

import "server-only";

import { MongoClient, type Db } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import { getEnv } from "../env";

interface CachedClient {
  uri: string;
  client: MongoClient;
  /** Settles once: the connected client, or the connect error. */
  connected: Promise<MongoClient>;
}

const globalForMongo = globalThis as typeof globalThis & { __gypsycircleMongo?: CachedClient };

function createClient(uri: string): CachedClient {
  const client = new MongoClient(uri, {
    appName: "gypsycircle-billing",
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
    retryWrites: true,
  });
  // On Vercel, keep the function alive while pool connections go idle
  if (process.env.VERCEL) attachDatabasePool(client);

  const forget = () => {
    if (globalForMongo.__gypsycircleMongo?.client === client) globalForMongo.__gypsycircleMongo = undefined;
  };
  client.once("topologyClosed", forget);

  const connected = client.connect().catch(async (err: unknown) => {
    forget();
    await client.close().catch(() => {});
    throw err;
  });
  connected.catch(() => {}); // callers get the error; never an unhandled rejection
  return { uri, client, connected };
}

/** The database, on a connected client (reconnects if the cached one failed or closed). */
export async function getDb(): Promise<Db> {
  const { MONGODB_URI, MONGODB_DB } = getEnv();
  let cached = globalForMongo.__gypsycircleMongo;
  if (cached?.uri !== MONGODB_URI) {
    cached = createClient(MONGODB_URI);
    globalForMongo.__gypsycircleMongo = cached;
  }
  return (await cached.connected).db(MONGODB_DB);
}

/** Closes the cached client (tests). */
export async function closeMongoClient(): Promise<void> {
  const cached = globalForMongo.__gypsycircleMongo;
  globalForMongo.__gypsycircleMongo = undefined;
  await cached?.client.close();
}
