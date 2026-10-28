// lib/server/security/rate-limit/mongo.ts
// MongoDB counters, shared by every serverless instance.
// Fixed window per key: one atomic update either counts into the open window
// or, if the window has ended (or never existed), starts a new one at 1. The
// TTL index on expiresAt removes ended windows on its own.

import "server-only";

import { rateLimitsCollection } from "../../db/collections";
import type { CounterState, CounterStore } from "./store";

const PREFIX = "login:";

export const mongoStore: CounterStore = {
  async increment(keys, windowMs) {
    const collection = await rateLimitsCollection();
    const docs = await Promise.all(
      keys.map((key) => {
        const open = { $gt: ["$expiresAt", "$$NOW"] };
        return collection.findOneAndUpdate(
          { _id: PREFIX + key },
          [
            {
              $set: {
                count: { $cond: [open, { $add: ["$count", 1] }, 1] },
                expiresAt: { $cond: [open, "$expiresAt", { $add: ["$$NOW", windowMs] }] },
              },
            },
          ],
          { upsert: true, returnDocument: "after" }
        );
      })
    );
    const now = Date.now();
    return docs.map((doc): CounterState => ({
      count: doc?.count ?? 1,
      resetInMs: doc ? Math.max(0, doc.expiresAt.getTime() - now) : windowMs,
    }));
  },

  async decrement(key) {
    await (await rateLimitsCollection()).updateOne(
      { _id: PREFIX + key, expiresAt: { $gt: new Date() }, count: { $gt: 0 } },
      { $inc: { count: -1 } }
    );
  },

  async reset(key) {
    await (await rateLimitsCollection()).deleteOne({ _id: PREFIX + key });
  },
};
