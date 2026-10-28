import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The limiter rules, run on the in-memory store (the MongoDB store has its own test)
vi.mock("./mongo", async () => ({ mongoStore: (await import("./memory")).memoryStore }));

import { recordLoginSuccess, registerLoginAttempt } from "./index";

function resetCounters() {
  delete (globalThis as Record<string, unknown>).__gc_rate_limit_counters__;
}

/** A wrong-code attempt: counted, and nothing taken back. */
const fail = (client: string) => registerLoginAttempt(client);

describe("login rate limiter (memory store)", () => {
  beforeEach(() => {
    resetCounters();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows 5 failed attempts per client, then blocks with Retry-After", async () => {
    for (let i = 0; i < 5; i++) expect((await fail("1.1.1.1")).allowed).toBe(true);
    const blocked = await registerLoginAttempt("1.1.1.1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(15 * 60);
    expect((await registerLoginAttempt("2.2.2.2")).allowed).toBe(true);
  });

  it("can't be bypassed by sending many attempts at once", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => registerLoginAttempt("1.1.1.1")));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("opens again when the 15-minute window ends", async () => {
    for (let i = 0; i < 6; i++) await fail("1.1.1.1");
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect((await registerLoginAttempt("1.1.1.1")).allowed).toBe(true);
  });

  it("a correct code clears the client's failures", async () => {
    for (let i = 0; i < 4; i++) await fail("1.1.1.1");
    expect((await registerLoginAttempt("1.1.1.1")).allowed).toBe(true);
    await recordLoginSuccess("1.1.1.1");
    for (let i = 0; i < 5; i++) expect((await fail("1.1.1.1")).allowed).toBe(true);
  });

  it("successful logins don't use up the global allowance", async () => {
    for (let i = 0; i < 100; i++) {
      await registerLoginAttempt(`10.0.${i}.1`);
      await recordLoginSuccess(`10.0.${i}.1`);
    }
    expect((await registerLoginAttempt("9.9.9.9")).allowed).toBe(true);
  });

  it("blocks everyone after 40 failures across clients, even after a success", async () => {
    for (let i = 0; i < 40; i++) await fail(`10.0.0.${i}`);
    await registerLoginAttempt("10.0.0.1");
    await recordLoginSuccess("10.0.0.1");
    expect((await registerLoginAttempt("9.9.9.9")).allowed).toBe(false);
  });
});
