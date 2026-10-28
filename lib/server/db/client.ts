// lib/server/db/client.ts
// One MongoDB client per server instance. Kept on globalThis so warm Vercel
// invocations and dev hot-reloads reuse the same connection pool instead of
// opening new connections on every request. The driver connects lazily on
// the first operation.

import "server-only";

import { MongoClient, type Db } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import { getEnv } from "../env";

interface CachedClient {
  uri: string;
  client: MongoClient;
}

const globalForMongo = globalThis as typeof globalThis & { __gypsycircleMongo?: CachedClient };

export function getMongoClient(): MongoClient {
  const { MONGODB_URI } = getEnv();
  const cached = globalForMongo.__gypsycircleMongo;
  if (cached?.uri === MONGODB_URI) return cached.client;

  const client = new MongoClient(MONGODB_URI, {
    appName: "gypsycircle-billing",
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
    retryWrites: true,
  });
  // On Vercel, close idle pool connections cleanly when a function suspends
  if (process.env.VERCEL) attachDatabasePool(client);

  globalForMongo.__gypsycircleMongo = { uri: MONGODB_URI, client };
  return client;
}

export function getDb(): Db {
  return getMongoClient().db(getEnv().MONGODB_DB);
}
