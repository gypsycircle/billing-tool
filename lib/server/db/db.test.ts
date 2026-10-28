// The database layer against a real (in-memory) MongoDB: the ledger queries
// give the expected answers and use their indexes, the invoice counter is
// atomic, versioned writes refuse stale screens, creates are idempotent, the
// access code is checked against its stored hash, and the login rate-limit
// counters work.

import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import type { Document } from "mongodb";
import { addDays, todayIST } from "@/lib/domain/dates";
import { parseBookingFilters } from "@/lib/domain/filters";
import { LEDGER_ROW_FIELDS, SEARCH_HIT_FIELDS, type Booking } from "@/lib/domain/types";

vi.mock("../guards", () => ({ verifySession: async () => {}, requireSessionOrRedirect: async () => {} }));

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGODB_URI: server.getUri(),
    MONGODB_DB: "billing_test",
    SESSION_SECRET: "x".repeat(40),
    INITIAL_INVOICE_NUMBER: "143",
  });
}, 120_000);

afterAll(async () => {
  const { closeMongoClient } = await import("./client");
  await closeMongoClient();
  await server.stop();
});

async function clear() {
  const { getDb } = await import("./client");
  const { ensureDatabase } = await import("./collections");
  await ensureDatabase();
  const db = await getDb();
  await Promise.all(["bookings", "counters", "rate_limits", "settings"].map((name) => db.collection(name).deleteMany({})));
}

beforeEach(clear);

// ── Fixtures ────────────────────────────────────────────────────────────────
const today = todayIST();

function booking(overrides: Partial<Booking>): Booking {
  return {
    bookingId: "a",
    invoiceNumber: "INV_20260143",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    invoiceDate: "05/01/2026",
    dueDate: "20/01/2026",
    customerName: "Adarsh Kumar",
    customerPhone: "+91 96335 69936",
    customerEmail: "",
    packageName: "Delhi - Agra Package",
    destination: "Delhi",
    batchName: "19th Jan Delhi",
    tripStartDate: "03/02/2026",
    tripEndDate: "08/02/2026",
    routeDescription: "",
    travellers: 2,
    ratePerPerson: 1_000,
    grossAmount: 2_000,
    discountAmount: 0,
    discountPercentage: 0,
    totalAmount: 2_000,
    amountPaid: 0,
    balanceAmount: 2_000,
    paymentStatus: "Unpaid",
    bookingStatus: "Active",
    invoiceNote: "",
    internalNotes: "",
    ...overrides,
  };
}

/** Four bookings, created a → c → b → d. */
const FOUR = [
  booking({}),
  booking({
    bookingId: "b", invoiceNumber: "INV_20260144", createdAt: "2026-01-03T00:00:00.000Z",
    customerName: "Meera", customerPhone: "9000011111", customerEmail: "meera@mail.com", destination: "Goa",
    amountPaid: 2_000, balanceAmount: 0, paymentStatus: "Paid",
  }),
  booking({ bookingId: "c", invoiceNumber: "INV_20260145", createdAt: "2026-01-02T00:00:00.000Z", bookingStatus: "Archived" }),
  booking({ bookingId: "d", invoiceNumber: "INV_20260150", createdAt: "2026-01-04T00:00:00.000Z", bookingStatus: "Cancelled" }),
];

async function seed(bookings: Booking[]) {
  const { bookingsCollection } = await import("./collections");
  const { toBookingDoc } = await import("./mapping");
  await (await bookingsCollection()).insertMany(bookings.map((b) => toBookingDoc(b)));
}

async function ledger(params: Record<string, string>, day = "10/01/2026") {
  const { ledgerPage } = await import("./bookings-repo");
  return ledgerPage(parseBookingFilters(params), day);
}

const ids = async (params: Record<string, string>, day?: string) => (await ledger(params, day)).items.map((b) => b.bookingId);

// ── Ledger ──────────────────────────────────────────────────────────────────
describe("ledgerPage", () => {
  beforeEach(() => seed(FOUR));

  it("hides archived bookings by default, shows only them when asked, newest first", async () => {
    expect(await ids({})).toEqual(["d", "b", "a"]);
    expect(await ids({ archived: "1" })).toEqual(["c"]);
  });

  it("searches name, email, invoice number and phone digits, literally and in any case", async () => {
    expect(await ids({ q: "meera" })).toEqual(["b"]);
    expect(await ids({ q: "MEERA@MAIL" })).toEqual(["b"]);
    expect(await ids({ q: "0150" })).toEqual(["d"]);
    expect(await ids({ q: "96335 699" })).toEqual(["d", "a"]);
    expect(await ids({ q: "Kumar (" })).toEqual([]);
  });

  it("filters by destination (any case), payment and status", async () => {
    expect(await ids({ destination: "goa" })).toEqual(["b"]);
    expect(await ids({ payment: "Paid" })).toEqual(["b"]);
    expect(await ids({ status: "Cancelled" })).toEqual(["d"]);
  });

  it("filters by due date: active bookings with a balance, overdue or due within 7 days", async () => {
    // a is due 20/01 with a balance; b is paid; d is cancelled
    expect(await ids({ due: "week" }, "14/01/2026")).toEqual(["a"]);
    expect(await ids({ due: "week" }, "20/01/2026")).toEqual(["a"]);
    expect(await ids({ due: "week" }, "12/01/2026")).toEqual([]);
    expect(await ids({ due: "overdue" }, "21/01/2026")).toEqual(["a"]);
    expect(await ids({ due: "overdue" }, "20/01/2026")).toEqual([]);
  });

  it("totals every match, and the active ones among them", async () => {
    expect((await ledger({})).totals).toEqual({
      count: 3, total: 6_000, received: 2_000, balance: 4_000,
      activeCount: 2, activeTotal: 4_000, activeReceived: 2_000, activeBalance: 2_000,
    });
    expect((await ledger({ archived: "1" })).totals).toMatchObject({ count: 1, total: 2_000, activeCount: 0 });
  });

  it("lists each destination once (any case), alphabetically, from every booking", async () => {
    await seed([booking({ bookingId: "e", invoiceNumber: "INV_20260151", destination: "goa " })]);
    expect((await ledger({ q: "nothing matches this" })).destinations).toEqual(["Delhi", "Goa"]);
  });

  it("returns only the columns the ledger shows", async () => {
    const [row] = (await ledger({})).items;
    expect(Object.keys(row).sort()).toEqual([...LEDGER_ROW_FIELDS].sort());
    expect(row).toMatchObject({ bookingId: "d", tripStartDate: "03/02/2026", updatedAt: "2026-01-01T00:00:00.000Z" });
  });

  it("tells no matches from an empty ledger", async () => {
    const result = await ledger({ q: "nobody" });
    expect([result.total, result.from, result.to, result.empty]).toEqual([0, 0, 0, false]);
    await clear();
    const empty = await ledger({});
    expect([empty.items, empty.page, empty.pageCount, empty.empty]).toEqual([[], 1, 1, true]);
    expect(empty.summary.activeCount).toBe(0);
  });
});

describe("ledgerPage pages and summary", () => {
  it("cuts pages of 25 and clamps a page past the end", async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      booking({
        bookingId: `id-${String(i).padStart(2, "0")}`,
        invoiceNumber: `INV_2026${String(200 + i).padStart(4, "0")}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      })
    );
    await seed(many);
    const newest = many.map((b) => b.bookingId).reverse();

    const second = await ledger({ page: "2" });
    expect([second.page, second.pageCount, second.from, second.to, second.total]).toEqual([2, 3, 26, 50, 60]);
    expect(second.items.map((b) => b.bookingId)).toEqual(newest.slice(25, 50));

    const past = await ledger({ page: "99" });
    expect([past.page, past.from, past.to]).toEqual([3, 51, 60]);
    expect(past.items.map((b) => b.bookingId)).toEqual(newest.slice(50));
  });

  it("sums active bookings, splitting balances into due within 7 days and overdue", async () => {
    let n = 0;
    const due = (dueDate: string, overrides: Partial<Booking> = {}) =>
      booking({ bookingId: `s${++n}`, invoiceNumber: `INV_2026${300 + n}`, dueDate, totalAmount: 10_000, amountPaid: 4_000, balanceAmount: 6_000, ...overrides });
    await seed([
      due("15/01/2026"), // due today → due soon
      due("22/01/2026"), // today + 7 → due soon
      due("23/01/2026"), // outside the window
      due("14/01/2026"), // overdue
      due("16/01/2026", { amountPaid: 10_000, balanceAmount: 0 }), // paid: neither
      due("14/01/2026", { bookingStatus: "Cancelled" }), // not active: not counted at all
      due("14/01/2026", { bookingStatus: "Archived" }),
    ]);
    expect((await ledger({}, "15/01/2026")).summary).toEqual({
      activeCount: 5, outstanding: 24_000, collected: 26_000, dueSoonCount: 2, dueSoonAmount: 12_000, overdueCount: 1,
    });
  });
});

// ── Query plans: every ledger query is served by an index ───────────────────
/** Every `stage` named anywhere in an explain() result. */
function stagesOf(plan: unknown, found: string[] = []): string[] {
  if (Array.isArray(plan)) plan.forEach((p) => stagesOf(p, found));
  else if (plan && typeof plan === "object") {
    for (const [key, value] of Object.entries(plan)) {
      if (key === "stage" && typeof value === "string") found.push(value);
      else if (key !== "rejectedPlans") stagesOf(value, found);
    }
  }
  return found;
}

describe("query plans", () => {
  async function pagePlan(params: Record<string, string>): Promise<string[]> {
    const { bookingsCollection } = await import("./collections");
    const { ledgerMatch } = await import("./ledger-query");
    const plan = await (await bookingsCollection())
      .find(ledgerMatch(parseBookingFilters(params), "10/01/2026"))
      .sort({ createdAt: -1, _id: 1 })
      .limit(25)
      .explain("queryPlanner");
    return stagesOf((plan as Document).queryPlanner.winningPlan);
  }

  beforeEach(() => seed(FOUR));

  it.each([
    ["the default view", {}],
    ["the archived view", { archived: "1" }],
    ["a status", { status: "Cancelled" }],
    ["a destination", { destination: "goa" }],
  ])("reads %s straight off an index, with no in-memory sort", async (_label, params) => {
    const stages = await pagePlan(params);
    expect(stages).toContain("IXSCAN");
    expect(stages).not.toContain("SORT");
    expect(stages).not.toContain("COLLSCAN");
  });

  it("uses an index for the due filter", async () => {
    expect(await pagePlan({ due: "overdue" })).not.toContain("COLLSCAN");
  });

  it("builds the destination list from the index alone", async () => {
    const { bookingsCollection } = await import("./collections");
    const { destinationsGroup } = await import("./ledger-query");
    const plan = await (await bookingsCollection()).aggregate(destinationsGroup).explain("queryPlanner");
    const stages = stagesOf(plan);
    expect(stages).toContain("DISTINCT_SCAN");
    expect(stages).not.toContain("COLLSCAN");
  });
});

// ── ⌘K search ───────────────────────────────────────────────────────────────
describe("searchBookings", () => {
  it("returns a few non-archived matches, newest first, with only what the menu shows", async () => {
    await seed(FOUR);
    const { searchBookings } = await import("./bookings-repo");
    const hits = await searchBookings(parseBookingFilters({ q: "adarsh" }), today, 8);
    expect(hits.map((h) => h.bookingId)).toEqual(["d", "a"]);
    expect(Object.keys(hits[0]).sort()).toEqual([...SEARCH_HIT_FIELDS].sort());
    expect(await searchBookings(parseBookingFilters({}), today, 2)).toHaveLength(2);
  });
});

// ── Invoice counter ────────────────────────────────────────────────────────
describe("invoice counter", () => {
  it("starts each year at 143 and hands out unique numbers to concurrent saves", async () => {
    const { issueInvoiceSequence, peekInvoiceSequence } = await import("./bookings-repo");
    expect(await peekInvoiceSequence(2026)).toBeNull();
    const issued = await Promise.all(Array.from({ length: 25 }, () => issueInvoiceSequence(2026, 143)));
    expect([...issued].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => 143 + i));
    expect(await peekInvoiceSequence(2026)).toBe(167);
    expect(await issueInvoiceSequence(2027, 143)).toBe(143);
  });
});

// ── Service: creates, versions, status ─────────────────────────────────────
const draft = () => ({
  customerName: "Adarsh",
  customerPhone: "9633569936",
  customerEmail: "Adarsh@Example.com",
  packageName: "Delhi - Agra Package",
  destination: "Delhi",
  batchName: "Batch A",
  tripStartDate: addDays(today, 30),
  tripEndDate: addDays(today, 34),
  routeDescription: "Agra-Delhi",
  travellers: 2,
  ratePerPerson: 10_000,
  discountAmount: 0,
  amountPaid: 5_000,
  invoiceNote: "",
  internalNotes: "",
});

describe("booking service on MongoDB", () => {
  it("creates bookings with sequential invoice numbers and server-set dates", async () => {
    const { createBooking, getBooking } = await import("../bookings/service");
    const year = today.slice(6);
    const a = await createBooking(draft());
    const b = await createBooking(draft());
    expect([a.invoiceNumber, b.invoiceNumber]).toEqual([`INV_${year}0143`, `INV_${year}0144`]);
    expect(a.invoiceDate).toBe(today);
    expect(a.customerEmail).toBe("adarsh@example.com");
    expect(await getBooking(a.bookingId)).toEqual(a);
  });

  it("returns the first booking for a repeated idempotency key, storing it once", async () => {
    const { createBooking } = await import("../bookings/service");
    const { bookingsCollection } = await import("./collections");
    const key = "abcdefgh-1234-5678";
    const [first, again] = await Promise.all([createBooking(draft(), key), createBooking(draft(), key)]);
    expect(again.bookingId).toBe(first.bookingId);
    expect(await (await bookingsCollection()).countDocuments()).toBe(1);
    // The repeat didn't use up a number: the next booking follows straight on
    const next = await createBooking(draft());
    expect(next.invoiceNumber.slice(-4)).toBe("0144");
  });

  it("refuses a stale edit (412) and a missing booking (404), and keeps the newer save", async () => {
    const { createBooking, getBooking, updateBooking } = await import("../bookings/service");
    const { BookingNotFoundError, StaleBookingError } = await import("../errors");
    const a = await createBooking(draft());
    const saved = await updateBooking(a.bookingId, { amountPaid: 8_000 }, a.updatedAt);
    expect(saved.amountPaid).toBe(8_000);
    expect(saved.updatedAt > a.updatedAt).toBe(true);
    await expect(updateBooking(a.bookingId, { amountPaid: 1 }, a.updatedAt)).rejects.toBeInstanceOf(StaleBookingError);
    await expect(updateBooking(crypto.randomUUID(), { amountPaid: 1 }, a.updatedAt)).rejects.toBeInstanceOf(BookingNotFoundError);
    expect((await getBooking(a.bookingId)).amountPaid).toBe(8_000);
  });

  it("answers 404 for an unknown booking before 428 for a missing version", async () => {
    const { archiveBooking, createBooking, setBookingStatus, updateBooking } = await import("../bookings/service");
    const { BookingNotFoundError, MissingVersionError } = await import("../errors");
    const unknown = crypto.randomUUID();
    await expect(updateBooking(unknown, { amountPaid: 1 }, "")).rejects.toBeInstanceOf(BookingNotFoundError);
    await expect(setBookingStatus(unknown, "Cancelled", "")).rejects.toBeInstanceOf(BookingNotFoundError);
    await expect(archiveBooking(unknown, "")).rejects.toBeInstanceOf(BookingNotFoundError);
    const a = await createBooking(draft());
    await expect(updateBooking(a.bookingId, { amountPaid: 1 }, "")).rejects.toBeInstanceOf(MissingVersionError);
    await expect(archiveBooking(a.bookingId, "")).rejects.toBeInstanceOf(MissingVersionError);
  });

  it("only lets one of two simultaneous edits of the same version through", async () => {
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(draft());
    const results = await Promise.allSettled([
      updateBooking(a.bookingId, { invoiceNote: "First" }, a.updatedAt),
      updateBooking(a.bookingId, { invoiceNote: "Second" }, a.updatedAt),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("archives, refuses cancelling an archived booking, and restores", async () => {
    const { archiveBooking, createBooking, setBookingStatus } = await import("../bookings/service");
    const { BookingArchivedError } = await import("../errors");
    const a = await createBooking(draft());
    const archived = await archiveBooking(a.bookingId, a.updatedAt);
    expect(archived.bookingStatus).toBe("Archived");
    await expect(setBookingStatus(a.bookingId, "Cancelled", archived.updatedAt)).rejects.toBeInstanceOf(BookingArchivedError);
    const restored = await setBookingStatus(a.bookingId, "Active", archived.updatedAt);
    expect(restored.bookingStatus).toBe("Active");
  });
});

// ── Login rate-limit counters ──────────────────────────────────────────────
describe("MongoDB rate-limit store", () => {
  it("counts within a window, decrements, resets, and starts a new window after expiry", async () => {
    const { mongoStore } = await import("../security/rate-limit/mongo");
    const [a1] = await mongoStore.increment(["ip:1.2.3.4"], 60_000);
    const [a2, g1] = await mongoStore.increment(["ip:1.2.3.4", "global"], 60_000);
    expect([a1.count, a2.count, g1.count]).toEqual([1, 2, 1]);
    expect(a2.resetInMs).toBeGreaterThan(50_000);

    await mongoStore.decrement("ip:1.2.3.4");
    expect((await mongoStore.increment(["ip:1.2.3.4"], 60_000))[0].count).toBe(2);

    await mongoStore.reset("ip:1.2.3.4");
    expect((await mongoStore.increment(["ip:1.2.3.4"], 60_000))[0].count).toBe(1);

    const [short] = await mongoStore.increment(["ip:9.9.9.9"], 50);
    expect(short.count).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await mongoStore.increment(["ip:9.9.9.9"], 50))[0].count).toBe(1); // the old window had ended
  });
});

// ── Bill of Supply reads only what it prints ───────────────────────────────
describe("getBillOfSupply", () => {
  it("renders from the bill's fields and refuses archived bookings", async () => {
    const { archiveBooking, createBooking, getBillOfSupply } = await import("../bookings/service");
    const { BillUnavailableError, BookingNotFoundError } = await import("../errors");
    const a = await createBooking(draft());
    const bill = await getBillOfSupply(a.bookingId);
    expect(bill.invoiceNumber).toBe(a.invoiceNumber);
    expect(new TextDecoder().decode(bill.pdf.slice(0, 5))).toBe("%PDF-");
    await archiveBooking(a.bookingId, a.updatedAt);
    await expect(getBillOfSupply(a.bookingId)).rejects.toBeInstanceOf(BillUnavailableError);
    await expect(getBillOfSupply(crypto.randomUUID())).rejects.toBeInstanceOf(BookingNotFoundError);
  });
});

// ── Access code ─────────────────────────────────────────────────────────────
describe("access code", () => {
  async function storeHash(hashedAccessCode: string) {
    const { settingsCollection } = await import("./collections");
    await (await settingsCollection()).updateOne(
      { _id: "access" },
      { $set: { hashedAccessCode, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  it("is refused as not set up until a hash is stored", async () => {
    const { verifyAccessCode } = await import("../session/access-code");
    const { AccessCodeNotSetError } = await import("../errors");
    await expect(verifyAccessCode("anything-at-all")).rejects.toBeInstanceOf(AccessCodeNotSetError);
  });

  it("accepts the right code and refuses a wrong one", async () => {
    const { hashAccessCode, verifyAccessCode } = await import("../session/access-code");
    const hash = await hashAccessCode("correct-horse-42");
    expect(hash).toMatch(/^scrypt\$17\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(await hashAccessCode("correct-horse-42")).not.toBe(hash); // salted
    await storeHash(hash);
    expect(await verifyAccessCode("correct-horse-42")).toBe(true);
    expect(await verifyAccessCode("correct-horse-43")).toBe(false);
    expect(await verifyAccessCode("")).toBe(false);
  });

  it("verifies a hash made outside the app in the documented format (as the setup script does)", async () => {
    const { verifyAccessCode } = await import("../session/access-code");
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync("set-by-script-1", salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    await storeHash(`scrypt$15$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`);
    expect(await verifyAccessCode("set-by-script-1")).toBe(true);
  });

  it("treats a malformed hash as not set up, and the database refuses a non-scrypt value", async () => {
    const { verifyAccessCode } = await import("../session/access-code");
    const { AccessCodeNotSetError } = await import("../errors");
    await storeHash("scrypt$nonsense");
    await expect(verifyAccessCode("anything-at-all")).rejects.toBeInstanceOf(AccessCodeNotSetError);
    await expect(storeHash("plain-text-code")).rejects.toThrow(/validation/i);
  });

  it("is reported by the health check", async () => {
    const { checkDatabase } = await import("./bookings-repo");
    const { hashAccessCode } = await import("../session/access-code");
    expect(await checkDatabase()).toMatchObject({ connected: true, collectionsReady: true, accessCodeSet: false });
    await storeHash(await hashAccessCode("correct-horse-42"));
    expect((await checkDatabase()).accessCodeSet).toBe(true);
  });
});
