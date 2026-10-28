// lib/server/security/rate-limit/store.ts
// Storage for fixed-window attempt counters.

import "server-only";

export interface CounterState {
  count: number;
  /** Milliseconds until this counter's window ends. */
  resetInMs: number;
}

export interface CounterStore {
  /**
   * Atomically adds 1 to each key (opening a window of `windowMs` if none is
   * open) and returns the counts AFTER the increment.
   */
  increment(keys: readonly string[], windowMs: number): Promise<CounterState[]>;
  /** Subtracts 1 from an open window (never below 0); no-op if none is open. */
  decrement(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}
