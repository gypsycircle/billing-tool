// lib/server/db/duplicate-key.ts
// A write refused by a unique index (an idempotency key or a record number
// already taken). `keyPattern` names the index's fields.

import "server-only";

import { MongoServerError } from "mongodb";

export const isDuplicateKey = (err: unknown): err is MongoServerError => err instanceof MongoServerError && err.code === 11000;
