// lib/server/security/rate-limit/memory.ts
// In-process counters: the fallback when the database can't be reached.
// Kept on globalThis so they survive dev hot reloads. Not shared between
// serverless instances. Each method runs without awaiting, so increments are
// atomic within the process.

import "server-only";

import type { CounterState, CounterStore } from "./store";

const MAX_ENTRIES = 10_000;
const STORE_KEY = "__gc_rate_limit_counters__";

interface Counter {
  count: number;
  expiresAt: number;
}

function counters(): Map<string, Counter> {
  const g = globalThis as Record<string, unknown>;
  g[STORE_KEY] ??= new Map<string, Counter>();
  return g[STORE_KEY] as Map<string, Counter>;
}

function live(key: string, now: number): Counter | undefined {
  const counter = counters().get(key);
  if (counter && counter.expiresAt <= now) {
    counters().delete(key);
    return undefined;
  }
  return counter;
}

/** Drops expired counters, then the oldest ones if still over the cap. */
function prune(now: number): void {
  const map = counters();
  if (map.size <= MAX_ENTRIES) return;
  for (const [key, counter] of map) {
    if (counter.expiresAt <= now) map.delete(key);
  }
  for (const key of map.keys()) {
    if (map.size <= MAX_ENTRIES) break;
    map.delete(key);
  }
}

export const memoryStore: CounterStore = {
  async increment(keys, windowMs) {
    const now = Date.now();
    const states = keys.map((key): CounterState => {
      let counter = live(key, now);
      if (counter) counter.count += 1;
      else {
        counter = { count: 1, expiresAt: now + windowMs };
        counters().set(key, counter);
      }
      return { count: counter.count, resetInMs: counter.expiresAt - now };
    });
    prune(now);
    return states;
  },

  async decrement(key) {
    const counter = live(key, Date.now());
    if (counter && counter.count > 0) counter.count -= 1;
  },

  async reset(key) {
    counters().delete(key);
  },
};
