// The database layer against a real (in-memory) MongoDB: the ledger queries
// give the expected answers and use their indexes, the invoice counter is
// atomic, versioned writes refuse stale screens, creates are idempotent, the
// access code is checked against its stored hash, and the login rate-limit
// counters work.

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "mongodb";
import { addDays, todayIST } from "@/lib/domain/dates";
import { PAGE_SIZE, parseBookingFilters } from "@/lib/domain/filters";
import { LEDGER_ROW_FIELDS, type Booking } from "@/lib/domain/types";
import { booking, bookingDraft as draft, LIST_IDS, seedBookings as seed, seedLists } from "./test-fixtures";
import { setUpTestDatabase, stagesOf } from "./test-database";

vi.mock("../guards", () => ({ verifySession: async () => {}, requireSessionOrRedirect: async () => {} }));

const { clear } = setUpTestDatabase("billing_test");
beforeEach(clear);
beforeEach(seedLists);

// ── Fixtures ────────────────────────────────────────────────────────────────
const today = todayIST();

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
    // a is due 20/01 with a balance (its trip starts 14 days later); b is paid; d is cancelled
    expect(await ids({ due: "week" }, "12/01/2026")).toEqual([]); // 22 days before the trip
    expect(await ids({ due: "overdue" }, "12/01/2026")).toEqual([]);
    expect(await ids({ due: "week" }, "13/01/2026")).toEqual(["a"]); // 21 days
    expect(await ids({ due: "overdue" }, "13/01/2026")).toEqual([]);
    expect(await ids({ due: "week" }, "19/01/2026")).toEqual(["a"]); // 15 days
    expect(await ids({ due: "overdue" }, "19/01/2026")).toEqual([]);
    expect(await ids({ due: "week" }, "20/01/2026")).toEqual([]); // 14 days: overdue from the due date itself
    expect(await ids({ due: "overdue" }, "20/01/2026")).toEqual(["a"]);
    expect(await ids({ due: "week" }, "21/01/2026")).toEqual([]); // 13 days
    expect(await ids({ due: "overdue" }, "21/01/2026")).toEqual(["a"]);
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

describe("ledgerPage by trip date", () => {
  it("filters by trip start date: a range, an open end, both ends included", async () => {
    await seed([
      booking({ bookingId: "jan", invoiceNumber: "INV_20260160", createdAt: "2026-01-05T00:00:00.000Z", tripStartDate: "31/01/2026", tripEndDate: "02/02/2026" }),
      booking({ bookingId: "feb", invoiceNumber: "INV_20260161", createdAt: "2026-01-06T00:00:00.000Z", tripStartDate: "01/02/2026", tripEndDate: "03/02/2026" }),
      booking({ bookingId: "mar", invoiceNumber: "INV_20260162", createdAt: "2026-01-07T00:00:00.000Z", tripStartDate: "01/03/2026", tripEndDate: "03/03/2026" }),
    ]);
    expect(await ids({ from: "2026-02-01", to: "2026-02-28" })).toEqual(["feb"]);
    expect(await ids({ from: "2026-01-31", to: "2026-02-01" })).toEqual(["feb", "jan"]);
    expect(await ids({ from: "2026-02-15" })).toEqual(["mar"]);
    expect(await ids({ to: "2026-01-31" })).toEqual(["jan"]);
    // A start after the end is ignored, as is a date that isn't one
    expect(await ids({ from: "2026-03-01", to: "2026-02-01" })).toEqual(["mar", "feb", "jan"]);
    expect(await ids({ from: "2026-02-30" })).toEqual(["mar", "feb", "jan"]);
  });
});

describe("ledgerPage pages and summary", () => {
  it("cuts pages of PAGE_SIZE and clamps a page past the end", async () => {
    // Four pages: three full ones and a part-filled last one
    const total = PAGE_SIZE * 3 + 5;
    const many = Array.from({ length: total }, (_, i) =>
      booking({
        bookingId: `id-${String(i).padStart(3, "0")}`,
        invoiceNumber: `INV_2026${String(200 + i).padStart(4, "0")}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      })
    );
    await seed(many);
    const newest = many.map((b) => b.bookingId).reverse();

    const second = await ledger({ page: "2" });
    expect([second.page, second.pageCount, second.from, second.to, second.total]).toEqual([2, 4, PAGE_SIZE + 1, PAGE_SIZE * 2, total]);
    expect(second.items.map((b) => b.bookingId)).toEqual(newest.slice(PAGE_SIZE, PAGE_SIZE * 2));

    const past = await ledger({ page: "99" });
    expect([past.page, past.from, past.to]).toEqual([4, PAGE_SIZE * 3 + 1, total]);
    expect(past.items.map((b) => b.bookingId)).toEqual(newest.slice(PAGE_SIZE * 3));
  });

  it("sums active bookings, splitting balances into due within 7 days and overdue", async () => {
    let n = 0;
    const due = (dueDate: string, overrides: Partial<Booking> = {}) =>
      booking({ bookingId: `s${++n}`, invoiceNumber: `INV_2026${300 + n}`, dueDate, totalAmount: 10_000, amountPaid: 4_000, balanceAmount: 6_000, ...overrides });
    await seed([
      due("16/01/2026"), // tomorrow → due soon
      due("22/01/2026"), // today + 7 → due soon
      due("23/01/2026"), // outside the window
      due("15/01/2026"), // due today → overdue
      due("14/01/2026"), // overdue
      due("16/01/2026", { amountPaid: 10_000, balanceAmount: 0 }), // paid: neither
      due("14/01/2026", { bookingStatus: "Cancelled" }), // not active: not counted at all
      due("14/01/2026", { bookingStatus: "Archived" }),
    ]);
    expect((await ledger({}, "15/01/2026")).summary).toEqual({
      // The cancelled booking's ₹4,000 is kept (no refund), so it counts as collected; the archived one's doesn't
      activeCount: 6, activeTravellers: 12, outstanding: 30_000, collected: 34_000, refundsDueCount: 0, refundsDueAmount: 0, dueSoonCount: 2, dueSoonAmount: 12_000, overdueCount: 2,
    });
  });
});

// ── Query plans: every ledger query is served by an index ───────────────────

describe("ledgerPage by booked date", () => {
  it("keeps only the bookings invoiced that day, with the other filters and in the archived view", async () => {
    await seed([
      booking({ bookingId: "jan1", invoiceNumber: "INV_20260170", invoiceDate: "01/01/2026", createdAt: "2026-01-01T00:00:00.000Z" }),
      booking({ bookingId: "jan2", invoiceNumber: "INV_20260171", invoiceDate: "02/01/2026", createdAt: "2026-01-02T00:00:00.000Z", destination: "Goa" }),
      booking({ bookingId: "jan2b", invoiceNumber: "INV_20260172", invoiceDate: "02/01/2026", createdAt: "2026-01-02T01:00:00.000Z", destination: "Delhi" }),
      booking({ bookingId: "gone", invoiceNumber: "INV_20260173", invoiceDate: "02/01/2026", createdAt: "2026-01-02T02:00:00.000Z", bookingStatus: "Archived" }),
    ]);
    expect(await ids({ booked: "2026-01-01" })).toEqual(["jan1"]);
    expect(await ids({ booked: "2026-01-02" })).toEqual(["jan2b", "jan2"]);
    expect(await ids({ booked: "2026-01-02", destination: "goa" })).toEqual(["jan2"]);
    expect(await ids({ booked: "2026-01-02", archived: "1" })).toEqual(["gone"]);
    expect(await ids({ booked: "2026-01-03" })).toEqual([]);
    // A date that isn't one is ignored
    expect(await ids({ booked: "2026-02-30" })).toEqual(["jan2b", "jan2", "jan1"]);
    expect((await ledger({ booked: "2026-01-02" })).totals.count).toBe(2);
  });
});

describe("query plans", () => {
  async function pagePlan(params: Record<string, string>): Promise<string[]> {
    const { bookingsCollection } = await import("./collections");
    const { ledgerHint, ledgerMatch } = await import("./ledger-query");
    const filters = parseBookingFilters(params);
    const hint = ledgerHint(filters);
    const plan = await (await bookingsCollection())
      .find(ledgerMatch(filters, "10/01/2026"), hint ? { hint } : {})
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
    ["a trip-date range", { from: "2026-02-01", to: "2026-02-28" }],
    ["a trip-date range in the archived view", { archived: "1", from: "2026-02-01" }],
    ["a booked date", { booked: "2026-01-02" }],
    ["a booked date in the archived view", { archived: "1", booked: "2026-01-02" }],
    ["a booked date and a destination", { booked: "2026-01-02", destination: "goa" }],
    ["a trip-date range and a destination", { from: "2026-02-01", destination: "goa" }],
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

// ── Invoice counter ────────────────────────────────────────────────────────
describe("invoice counter", () => {
  it("starts each year at 143 and hands out unique numbers to concurrent saves", async () => {
    const { issueSequence, peekSequence } = await import("./counters-repo");
    expect(await peekSequence("invoice", 2026)).toBeNull();
    const issued = await Promise.all(Array.from({ length: 25 }, () => issueSequence("invoice", 2026, 143)));
    expect([...issued].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => 143 + i));
    expect(await peekSequence("invoice", 2026)).toBe(167);
    expect(await issueSequence("invoice", 2027, 143)).toBe(143);
    expect(await issueSequence("expense", 2026, 1)).toBe(1); // sequences don't share numbers
  });
});

// ── Service: creates, versions, status ─────────────────────────────────────
// ── Payments: every change to amount paid, dated ──────────────────────────
async function paymentsOf(bookingId: string) {
  const { paymentsCollection } = await import("./collections");
  const docs = await (await paymentsCollection()).find({ bookingId }).sort({ createdAt: 1 }).toArray();
  return docs.map((p) => ({ amount: p.amount, source: p.source, paidOn: p.paidOn.toISOString().slice(0, 10) }));
}

const isoToday = () => { const [d, m, y] = today.split("/"); return `${y}-${m}-${d}`; };

describe("payments record", () => {
  it("records what a new booking was paid, dated today, and nothing for an unpaid one", async () => {
    const { createBooking } = await import("../bookings/service");
    const paid = await createBooking(draft());
    const unpaid = await createBooking({ ...draft(), amountPaid: 0 });
    expect(await paymentsOf(paid.bookingId)).toEqual([{ amount: 5_000, source: "create", paidOn: isoToday() }]);
    expect(await paymentsOf(unpaid.bookingId)).toEqual([]);
  });

  it("records the difference an edit makes: more paid, a correction down, and nothing when unchanged", async () => {
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(draft());
    const more = await updateBooking(a.bookingId, { amountPaid: 20_000 }, a.updatedAt);
    const less = await updateBooking(a.bookingId, { amountPaid: 2_000 }, more.updatedAt);
    await updateBooking(a.bookingId, { invoiceNote: "Window seats" }, less.updatedAt);
    expect((await paymentsOf(a.bookingId)).map((p) => [p.amount, p.source])).toEqual([
      [5_000, "create"],
      [15_000, "edit"],
      [-18_000, "edit"],
    ]);
    // The entries always add up to what the booking says was paid
    expect((await paymentsOf(a.bookingId)).reduce((sum, p) => sum + p.amount, 0)).toBe(2_000);
  });

  it("records nothing for a refused (stale) edit, and one entry when two saves race", async () => {
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(draft());
    const b = await updateBooking(a.bookingId, { amountPaid: 6_000 }, a.updatedAt);
    await expect(updateBooking(a.bookingId, { amountPaid: 9_000 }, a.updatedAt)).rejects.toThrow();
    await Promise.allSettled([
      updateBooking(a.bookingId, { amountPaid: 7_000 }, b.updatedAt),
      updateBooking(a.bookingId, { amountPaid: 8_000 }, b.updatedAt),
    ]);
    const entries = await paymentsOf(a.bookingId);
    expect(entries).toHaveLength(3); // create, the 6,000 edit, and one race winner
    const { getBooking } = await import("../bookings/service");
    expect(entries.reduce((sum, p) => sum + p.amount, 0)).toBe((await getBooking(a.bookingId)).amountPaid);
  });

  it("stores a booking and its payment together or not at all", async () => {
    const { insertBooking } = await import("./bookings-repo");
    const { bookingsCollection } = await import("./collections");
    const { historyEntry } = await import("./history-repo");
    const broken = { _id: crypto.randomUUID(), bookingId: "x", amount: 5, paidOn: new Date(), source: "nope", createdAt: new Date() };
    const b = booking({ bookingId: crypto.randomUUID(), invoiceNumber: "INV_20269999" });
    // The payments validator refuses the entry, so the booking must not be stored either
    await expect(insertBooking(b, broken as never, historyEntry(b.bookingId, today, b))).rejects.toThrow(/validation/i);
    expect(await (await bookingsCollection()).countDocuments({ _id: b.bookingId })).toBe(0);
  });

  it("records one entry for a repeated create, on this instance or another", async () => {
    const { createBooking } = await import("../bookings/service");
    const { insertBooking } = await import("./bookings-repo");
    const { historyEntry } = await import("./history-repo");
    const { paymentEntry } = await import("./payments-repo");
    // This instance: the repeat waits for the first and gets its booking
    const key = "pay-key-1234567890ab";
    const [first] = await Promise.all([createBooking(draft(), key), createBooking(draft(), key)]);
    expect(await paymentsOf(first.bookingId)).toHaveLength(1);
    // Another instance: its insert hits the unique key, its transaction is undone, the first booking comes back
    const repeat = booking({ bookingId: crypto.randomUUID(), invoiceNumber: "INV_20268888", amountPaid: 1_000 });
    const returned = await insertBooking(repeat, paymentEntry(repeat.bookingId, 1_000, today, "create"), historyEntry(repeat.bookingId, today, repeat), key);
    expect(returned.bookingId).toBe(first.bookingId);
    expect(await paymentsOf(repeat.bookingId)).toEqual([]);
    expect(await paymentsOf(first.bookingId)).toHaveLength(1);
  });

  it("refuses a zero or unknown-source payment entry at the database", async () => {
    const { paymentsCollection } = await import("./collections");
    const base = { _id: crypto.randomUUID(), bookingId: "b", amount: 5, paidOn: new Date(), source: "edit", createdAt: new Date() };
    const collection = await paymentsCollection();
    await expect(collection.insertOne({ ...base, amount: 0 } as never)).rejects.toThrow(/validation/i);
    await expect(collection.insertOne({ ...base, _id: crypto.randomUUID(), source: "manual" } as never)).rejects.toThrow(/validation/i);
    await collection.insertOne({ ...base, _id: crypto.randomUUID(), amount: -5 } as never); // corrections are negative
  });

  it("writes no payment when a booking is archived or restored", async () => {
    const { archiveBooking, createBooking, setBookingStatus } = await import("../bookings/service");
    const a = await createBooking(draft());
    const archived = await archiveBooking(a.bookingId, a.updatedAt);
    await setBookingStatus(a.bookingId, "Active", archived.updatedAt);
    expect(await paymentsOf(a.bookingId)).toHaveLength(1);
  });
});

describe("bookings pick destination, package and route from the lists", () => {
  const listed = async (overrides: Record<string, unknown>) => {
    const { createBooking } = await import("../bookings/service");
    return createBooking({ ...draft(), ...overrides }).then(
      (b) => [b.destination, b.packageName, b.routeDescription],
      (err) => err.fieldErrors
    );
  };

  it("stores the list's own spelling, and accepts no route", async () => {
    expect(await listed({ destination: " delhi", packageName: "DELHI - AGRA PACKAGE", routeDescription: "agra-delhi" })).toEqual(["Delhi", "Delhi - Agra Package", "Agra-Delhi"]);
    expect(await listed({ routeDescription: "" })).toEqual(["Delhi", "Delhi - Agra Package", ""]);
  });

  it("refuses names that aren't active in their list, saying which field, and uses no invoice number", async () => {
    const { generalCollection } = await import("./collections");
    const { createBooking } = await import("../bookings/service");
    expect(await listed({ destination: "Goa", packageName: "Agra-Delhi", routeDescription: "Delhi" })).toEqual({
      destination: "Pick a destination from the list (add new ones in Settings).",
      packageName: "Pick a package from the list (add new ones in Settings).",
      routeDescription: "Pick a route from the list (add new ones in Settings).",
    });
    await (await generalCollection()).updateOne({ _id: LIST_IDS.destination }, { $set: { status: "Archived" } });
    expect(await listed({})).toEqual({ destination: expect.stringMatching(/Pick a destination/) });
    await (await generalCollection()).updateOne({ _id: LIST_IDS.destination }, { $set: { status: "Active" } });
    expect((await createBooking(draft())).invoiceNumber).toBe(`INV_${today.slice(6)}0143`);
  });

  it("keeps an unchanged value on edit, even archived or differently cased, but checks a changed one", async () => {
    const { generalCollection } = await import("./collections");
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(draft());
    await (await generalCollection()).updateMany({}, { $set: { status: "Archived" } });
    const b = await updateBooking(a.bookingId, { destination: "DELHI", travellers: 3 }, a.updatedAt);
    expect([b.destination, b.travellers]).toEqual(["Delhi", 3]);
    await expect(updateBooking(a.bookingId, { packageName: "Goa Trip" }, b.updatedAt)).rejects.toMatchObject({ fieldErrors: { packageName: expect.stringMatching(/Pick a package/) } });
    expect((await updateBooking(a.bookingId, { routeDescription: "" }, b.updatedAt)).routeDescription).toBe("");
  });

  it("offers the form each list's active names, by name", async () => {
    const { generalCollection } = await import("./collections");
    const { getBookingListOptions } = await import("../bookings/service");
    const now = new Date();
    await (await generalCollection()).insertOne({ _id: crypto.randomUUID(), kind: "destination", name: "Agra", nameKey: "agra", status: "Active", createdAt: now, updatedAt: now });
    await (await generalCollection()).updateOne({ _id: LIST_IDS.route }, { $set: { status: "Archived" } });
    expect(await getBookingListOptions()).toEqual({ destination: ["Agra", "Delhi"], packageName: ["Delhi - Agra Package"], routeDescription: [] });
  });
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
    const { NotFoundError, StaleRecordError } = await import("../errors");
    const a = await createBooking(draft());
    const saved = await updateBooking(a.bookingId, { amountPaid: 8_000 }, a.updatedAt);
    expect(saved.amountPaid).toBe(8_000);
    expect(saved.updatedAt > a.updatedAt).toBe(true);
    await expect(updateBooking(a.bookingId, { amountPaid: 1 }, a.updatedAt)).rejects.toBeInstanceOf(StaleRecordError);
    await expect(updateBooking(crypto.randomUUID(), { amountPaid: 1 }, a.updatedAt)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getBooking(a.bookingId)).amountPaid).toBe(8_000);
  });

  it("answers 404 for an unknown booking before 428 for a missing version", async () => {
    const { archiveBooking, createBooking, setBookingStatus, updateBooking } = await import("../bookings/service");
    const { NotFoundError, MissingVersionError } = await import("../errors");
    const unknown = crypto.randomUUID();
    await expect(updateBooking(unknown, { amountPaid: 1 }, "")).rejects.toBeInstanceOf(NotFoundError);
    await expect(setBookingStatus(unknown, "Cancelled", "")).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveBooking(unknown, "")).rejects.toBeInstanceOf(NotFoundError);
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
    const { ArchivedRecordError } = await import("../errors");
    const a = await createBooking(draft());
    const archived = await archiveBooking(a.bookingId, a.updatedAt);
    expect(archived.bookingStatus).toBe("Archived");
    await expect(setBookingStatus(a.bookingId, "Cancelled", archived.updatedAt)).rejects.toBeInstanceOf(ArchivedRecordError);
    const restored = await setBookingStatus(a.bookingId, "Active", archived.updatedAt);
    expect(restored.bookingStatus).toBe("Active");
  });

  it("takes a PATCH as a status change when it is { bookingStatus } alone, else as an edit", async () => {
    const { changeBooking, createBooking } = await import("../bookings/service");
    const a = await createBooking(draft());
    const cancelled = await changeBooking(a.bookingId, { bookingStatus: "Cancelled" }, a.updatedAt);
    expect(cancelled.bookingStatus).toBe("Cancelled");
    const edited = await changeBooking(a.bookingId, { invoiceNote: "Note" }, cancelled.updatedAt);
    expect(edited).toMatchObject({ bookingStatus: "Cancelled", invoiceNote: "Note" });
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
    const { BillUnavailableError, NotFoundError } = await import("../errors");
    const a = await createBooking(draft());
    const bill = await getBillOfSupply(a.bookingId);
    expect(bill.invoiceNumber).toBe(a.invoiceNumber);
    expect([bill.type, bill.fileName]).toEqual(["application/pdf", `Bill-of-Supply-${a.invoiceNumber}.pdf`]);
    expect(new TextDecoder().decode(bill.bytes.slice(0, 5))).toBe("%PDF-");
    await archiveBooking(a.bookingId, a.updatedAt);
    await expect(getBillOfSupply(a.bookingId)).rejects.toBeInstanceOf(BillUnavailableError);
    await expect(getBillOfSupply(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
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

// ── Booking history: a row when people, total or amount paid change ───────
describe("booking history", () => {
  const rowsOf = async (id: string) => {
    const { getBookingHistory } = await import("../bookings/service");
    return (await getBookingHistory(id)).map((r) => [r.change, r.travellers, r.totalAmount, r.payment, r.amountPaid, r.balanceAmount]);
  };
  const docsOf = async (id: string) => {
    const { bookingHistoryCollection } = await import("./collections");
    return (await bookingHistoryCollection()).find({ bookingId: id }).sort({ createdAt: 1 }).toArray();
  };
  const twoPeople = () => ({ ...draft(), travellers: 2, ratePerPerson: 5_500, discountAmount: 0, internalNotes: "Team only" });

  it("adds a row on create, even with nothing paid", async () => {
    const { createBooking } = await import("../bookings/service");
    const unpaid = await createBooking({ ...twoPeople(), amountPaid: 0 });
    expect(await rowsOf(unpaid.bookingId)).toEqual([["Booking created", 2, 11_000, 0, 0, 11_000]]);
  });

  it("keeps each row as it stood: a person added, then a payment, with no change to older rows", async () => {
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(twoPeople());
    const b = await updateBooking(a.bookingId, { travellers: 3 }, a.updatedAt);
    await updateBooking(a.bookingId, { amountPaid: 8_000 }, b.updatedAt);
    expect(await rowsOf(a.bookingId)).toEqual([
      ["Payment", 3, 16_500, 3_000, 8_000, 8_500],
      ["1 person added", 3, 16_500, 0, 5_000, 11_500],
      ["Booking created", 2, 11_000, 5_000, 5_000, 6_000],
    ]);
    // A person added with no money moves nothing in cash collected
    expect((await paymentsOf(a.bookingId)).map((p) => p.amount)).toEqual([5_000, 3_000]);
  });

  it("adds a row when the rate or discount changes the total, and one row for several changes", async () => {
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(twoPeople());
    const b = await updateBooking(a.bookingId, { discountAmount: 1_000 }, a.updatedAt);
    await updateBooking(a.bookingId, { travellers: 3, amountPaid: 9_000 }, b.updatedAt);
    expect((await rowsOf(a.bookingId)).map((r) => r[0])).toEqual(["1 person added · Payment", "Total changed", "Booking created"]);
  });

  it("adds no row for dates, place, names, notes, archiving or restoring, and a later row picks them up", async () => {
    const { archiveBooking, createBooking, setBookingStatus, updateBooking } = await import("../bookings/service");
    const a = await createBooking(twoPeople());
    const b = await updateBooking(a.bookingId, { customerName: "Renamed", batchName: "New batch", invoiceNote: "Note", internalNotes: "More" }, a.updatedAt);
    const c = await updateBooking(a.bookingId, { tripEndDate: addDays(b.tripEndDate, 1) }, b.updatedAt);
    const archived = await archiveBooking(a.bookingId, c.updatedAt);
    const restored = await setBookingStatus(a.bookingId, "Active", archived.updatedAt);
    expect(await docsOf(a.bookingId)).toHaveLength(1);
    await updateBooking(a.bookingId, { amountPaid: 6_000 }, restored.updatedAt);
    const docs = await docsOf(a.bookingId);
    expect(docs.map((row) => row.bill.customerName)).toEqual(["Adarsh", "Renamed"]);
  });

  it("adds nothing for a refused (stale) edit, and copies only what the bill prints", async () => {
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(twoPeople());
    await updateBooking(a.bookingId, { amountPaid: 6_000 }, a.updatedAt);
    await expect(updateBooking(a.bookingId, { amountPaid: 9_000 }, a.updatedAt)).rejects.toThrow();
    const docs = await docsOf(a.bookingId);
    expect(docs).toHaveLength(2);
    for (const doc of docs) for (const field of ["customerEmail", "internalNotes", "bookingStatus"]) expect(doc.bill).not.toHaveProperty(field);
  });

  it("serves each row's own bill, for that booking only; archived bookings have none", async () => {
    const { archiveBooking, createBooking, getBookingHistory, getHistoryBill, updateBooking } = await import("../bookings/service");
    const a = await createBooking(twoPeople());
    const more = await updateBooking(a.bookingId, { travellers: 3 }, a.updatedAt);
    const other = await createBooking(twoPeople());
    const [latest, first] = await getBookingHistory(a.bookingId);
    const file = await getHistoryBill(a.bookingId, first.entryId);
    expect(new TextDecoder().decode(file.bytes.slice(0, 5))).toBe("%PDF-");
    expect(file.fileName).toBe(`Bill-of-Supply-${a.invoiceNumber}-${isoToday()}.pdf`);
    await expect(getHistoryBill(other.bookingId, first.entryId)).rejects.toThrow("History entry not found.");
    await expect(getHistoryBill(a.bookingId, crypto.randomUUID())).rejects.toThrow("History entry not found.");
    await expect(getHistoryBill(a.bookingId, "nope")).rejects.toThrow("History entry not found.");
    await archiveBooking(a.bookingId, more.updatedAt);
    await expect(getHistoryBill(a.bookingId, latest.entryId)).rejects.toThrow(/Archived bookings have no bill/);
    expect(await getBookingHistory(a.bookingId)).toHaveLength(2);
  });

  it("reads a booking's rows straight off the index, in order", async () => {
    const { bookingHistoryCollection } = await import("./collections");
    const plan = await (await bookingHistoryCollection()).find({ bookingId: "x" }).sort({ changedOn: 1, createdAt: 1 }).explain("queryPlanner");
    const stages = stagesOf((plan as Document).queryPlanner.winningPlan);
    expect(stages).toContain("IXSCAN");
    expect(stages).not.toContain("SORT");
  });
});

// ── Cancellations and refunds ─────────────────────────────────────────────
describe("cancelling a booking", () => {
  const ref = async () => ({ ...(await import("../bookings/service")), ...(await import("../errors")) });
  const trip = (days: number) => ({ tripStartDate: addDays(today, days), tripEndDate: addDays(today, days + 3) });
  /** ₹20,000 package. */
  const package20k = (over = {}) => ({ ...draft(), ...trip(35), travellers: 2, ratePerPerson: 10_000, discountAmount: 0, amountPaid: 20_000, ...over });

  it("works the refund out from the terms and the slot amount, unless one is given", async () => {
    const { changeBooking, createBooking, getBooking } = await ref();
    const full = await createBooking(package20k());
    await changeBooking(full.bookingId, { bookingStatus: "Cancelled" }, full.updatedAt);
    expect(await getBooking(full.bookingId)).toMatchObject({ bookingStatus: "Cancelled", cancelledOn: today, refundAmount: 15_000, refundedOn: null });

    const part = await createBooking(package20k({ amountPaid: 10_000, slotAmount: 5_000 }));
    await changeBooking(part.bookingId, { bookingStatus: "Cancelled" }, part.updatedAt);
    expect((await getBooking(part.bookingId)).refundAmount).toBe(5_000);

    const own = await createBooking(package20k());
    await changeBooking(own.bookingId, { bookingStatus: "Cancelled", refundAmount: 1_000 }, own.updatedAt);
    expect((await getBooking(own.bookingId)).refundAmount).toBe(1_000);
  });

  it("refuses a refund above what was received, and leaves the booking alone", async () => {
    const { changeBooking, createBooking, getBooking } = await ref();
    const a = await createBooking(package20k({ amountPaid: 3_000 }));
    await expect(changeBooking(a.bookingId, { bookingStatus: "Cancelled", refundAmount: 3_001 }, a.updatedAt)).rejects.toMatchObject({ fieldErrors: { refundAmount: expect.stringContaining("₹3,000") } });
    expect((await getBooking(a.bookingId)).bookingStatus).toBe("Active");
  });

  it("marks the refund paid, can undo it, and checks the date", async () => {
    const { changeBooking, createBooking, getBooking } = await ref();
    const a = await createBooking(package20k());
    const c = await changeBooking(a.bookingId, { bookingStatus: "Cancelled", refundAmount: 2_000 }, a.updatedAt);
    await expect(changeBooking(a.bookingId, { refundedOn: addDays(today, 1) }, c.updatedAt)).rejects.toMatchObject({ fieldErrors: { refundedOn: expect.stringContaining("future") } });
    await expect(changeBooking(a.bookingId, { refundedOn: addDays(today, -1) }, c.updatedAt)).rejects.toMatchObject({ fieldErrors: { refundedOn: expect.stringContaining("before") } });
    const paid = await changeBooking(a.bookingId, { refundedOn: today }, c.updatedAt);
    expect((await getBooking(a.bookingId)).refundedOn).toBe(today);
    await expect(changeBooking(a.bookingId, { refundAmount: 500 }, paid.updatedAt)).rejects.toThrow(/Untick/);
    const undone = await changeBooking(a.bookingId, { refundedOn: null }, paid.updatedAt);
    expect((await getBooking(a.bookingId)).refundedOn).toBeNull();
    await changeBooking(a.bookingId, { refundAmount: 500 }, undone.updatedAt);
    expect((await getBooking(a.bookingId)).refundAmount).toBe(500);
  });

  it("refuses a refund on an active booking, and a stale refund change", async () => {
    const { changeBooking, createBooking, StaleRecordError } = await ref();
    const a = await createBooking(package20k());
    await expect(changeBooking(a.bookingId, { refundAmount: 100 }, a.updatedAt)).rejects.toThrow(/Only a cancelled booking/);
    const c = await changeBooking(a.bookingId, { bookingStatus: "Cancelled" }, a.updatedAt);
    await changeBooking(a.bookingId, { refundAmount: 100 }, c.updatedAt);
    await expect(changeBooking(a.bookingId, { refundAmount: 200 }, c.updatedAt)).rejects.toBeInstanceOf(StaleRecordError);
  });

  it("reactivating clears the refund, and is refused once it has gone back", async () => {
    const { changeBooking, createBooking, getBooking } = await ref();
    const a = await createBooking(package20k());
    const c = await changeBooking(a.bookingId, { bookingStatus: "Cancelled", refundAmount: 2_000 }, a.updatedAt);
    const paid = await changeBooking(a.bookingId, { refundedOn: today }, c.updatedAt);
    await expect(changeBooking(a.bookingId, { bookingStatus: "Active" }, paid.updatedAt)).rejects.toThrow(/Untick/);
    const undone = await changeBooking(a.bookingId, { refundedOn: null }, paid.updatedAt);
    await changeBooking(a.bookingId, { bookingStatus: "Active" }, undone.updatedAt);
    expect(await getBooking(a.bookingId)).toMatchObject({ bookingStatus: "Active", cancelledOn: null, refundAmount: 0, refundedOn: null });
  });

  it("locks the money while cancelled, but not the other details", async () => {
    const { changeBooking, createBooking, updateBooking, getBooking } = await ref();
    const a = await createBooking(package20k());
    const c = await changeBooking(a.bookingId, { bookingStatus: "Cancelled" }, a.updatedAt);
    for (const change of [{ amountPaid: 1_000 }, { travellers: 3 }, { ratePerPerson: 1 }, { discountAmount: 1 }, { slotAmount: 1 }]) {
      await expect(updateBooking(a.bookingId, change, c.updatedAt)).rejects.toThrow(/Reactivate/);
    }
    await updateBooking(a.bookingId, { invoiceNote: "Still fine" }, c.updatedAt);
    expect((await getBooking(a.bookingId)).invoiceNote).toBe("Still fine");
  });

  it("restoring from the archive keeps a cancelled booking cancelled, with its refund", async () => {
    const { archiveBooking, changeBooking, createBooking, getBooking, setBookingStatus } = await ref();
    const a = await createBooking(package20k());
    const c = await changeBooking(a.bookingId, { bookingStatus: "Cancelled", refundAmount: 2_000 }, a.updatedAt);
    const archived = await archiveBooking(a.bookingId, c.updatedAt);
    await setBookingStatus(a.bookingId, "Active", archived.updatedAt);
    expect(await getBooking(a.bookingId)).toMatchObject({ bookingStatus: "Cancelled", refundAmount: 2_000 });
    const plain = await createBooking(package20k());
    const gone = await archiveBooking(plain.bookingId, plain.updatedAt);
    await setBookingStatus(plain.bookingId, "Active", gone.updatedAt);
    expect((await getBooking(plain.bookingId)).bookingStatus).toBe("Active");
  });

  it("keeps the slot amount through edits, off the bill, and within the total", async () => {
    const { createBooking, updateBooking, getBooking } = await ref();
    const a = await createBooking(package20k({ slotAmount: 5_000 }));
    await updateBooking(a.bookingId, { invoiceNote: "Note" }, a.updatedAt);
    expect((await getBooking(a.bookingId)).slotAmount).toBe(5_000);
    await expect(createBooking(package20k({ slotAmount: 20_001 }))).rejects.toMatchObject({ fieldErrors: { slotAmount: expect.any(String) } });
    expect((await createBooking(package20k())).slotAmount).toBe(0);
  });

  it("writes history rows for each step, and none for a refused one", async () => {
    const { changeBooking, createBooking, getBookingHistory } = await ref();
    const a = await createBooking(package20k({ travellers: 2, ratePerPerson: 1_500, amountPaid: 3_000 }));
    const c = await changeBooking(a.bookingId, { bookingStatus: "Cancelled", refundAmount: 2_000 }, a.updatedAt);
    await expect(changeBooking(a.bookingId, { refundAmount: 9_000 }, c.updatedAt)).rejects.toThrow();
    await changeBooking(a.bookingId, { refundedOn: today }, c.updatedAt);
    expect((await getBookingHistory(a.bookingId)).map((r) => [r.change, r.payment, r.received, r.balance])).toEqual([
      ["Refund paid", -2_000, 1_000, null],
      ["Cancelled · ₹2,000 to refund", 0, 3_000, null],
      ["Booking created", 3_000, 3_000, 0],
    ]);
  });

  it("the Bookings tiles and totals keep what isn't refunded, and show what's still owed", async () => {
    const { changeBooking, createBooking, getBookingLedger } = await ref();
    const active = await createBooking(package20k({ amountPaid: 5_000, customerName: "Active One" }));
    const a = await createBooking(package20k({ amountPaid: 3_000 }));
    const c = await changeBooking(a.bookingId, { bookingStatus: "Cancelled", refundAmount: 2_000 }, a.updatedAt);
    const ledger = (params = {}) => getBookingLedger(parseBookingFilters(params));
    const { summary: owed, totals } = await ledger();
    expect(owed).toMatchObject({ activeCount: 1, outstanding: active.balanceAmount, collected: 6_000, refundsDueCount: 1, refundsDueAmount: 2_000 });
    expect(totals).toMatchObject({ activeReceived: 6_000, activeTotal: active.totalAmount });
    expect((await ledger({ payment: "Refund due" })).items.map((r) => r.bookingId)).toEqual([a.bookingId]);
    expect((await ledger({ payment: "Refunded" })).items).toEqual([]);
    await changeBooking(a.bookingId, { refundedOn: today }, c.updatedAt);
    expect((await ledger()).summary).toMatchObject({ collected: 6_000, refundsDueCount: 0, refundsDueAmount: 0 });
    expect((await ledger({ payment: "Refunded" })).items.map((r) => r.bookingId)).toEqual([a.bookingId]);
    expect((await ledger({ payment: "Refund due" })).items).toEqual([]);
  });
});

describe("the invoice date of a new booking", () => {
  const today = () => todayIST();
  const yesterday = () => addDays(todayIST(), -1);

  it("defaults to today, and can be yesterday", async () => {
    const { createBooking } = await import("../bookings/service");
    expect((await createBooking(draft())).invoiceDate).toBe(today());
    expect((await createBooking({ ...draft(), invoiceDate: yesterday() })).invoiceDate).toBe(yesterday());
  });

  it("refuses any other day, and uses up no number", async () => {
    const { createBooking } = await import("../bookings/service");
    for (const invoiceDate of [addDays(today(), 1), addDays(today(), -2)]) {
      await expect(createBooking({ ...draft(), invoiceDate })).rejects.toMatchObject({ fieldErrors: { invoiceDate: "Invoice date must be today or yesterday." } });
    }
    expect((await createBooking(draft())).invoiceNumber.endsWith("0143")).toBe(true);
  });

  it("dates the due date, first payment and first history row from yesterday", async () => {
    const { createBooking, getBookingHistory } = await import("../bookings/service");
    const tripStartDate = addDays(today(), 3);
    const a = await createBooking({ ...draft(), invoiceDate: yesterday(), tripStartDate, tripEndDate: addDays(today(), 5) });
    expect(a.dueDate).toBe(yesterday());
    const { paymentsCollection } = await import("./collections");
    const { formatDDMMYYYY } = await import("@/lib/domain/dates");
    const [payment] = await (await paymentsCollection()).find({ bookingId: a.bookingId }).toArray();
    expect(formatDDMMYYYY(payment.paidOn)).toBe(yesterday());
    expect((await getBookingHistory(a.bookingId))[0].changedOn).toBe(yesterday());
  });

  it("lets the trip start today only when the invoice is dated yesterday", async () => {
    const { createBooking } = await import("../bookings/service");
    const trip = { tripStartDate: today(), tripEndDate: addDays(today(), 1) };
    expect((await createBooking({ ...draft(), ...trip, invoiceDate: yesterday() })).dueDate).toBe(yesterday());
    await expect(createBooking({ ...draft(), ...trip })).rejects.toMatchObject({ fieldErrors: { tripStartDate: expect.any(String) } });
  });

  it("can't be changed by an edit", async () => {
    const { createBooking, updateBooking } = await import("../bookings/service");
    const a = await createBooking(draft());
    await expect(updateBooking(a.bookingId, { invoiceDate: yesterday() }, a.updatedAt)).rejects.toMatchObject({ fieldErrors: expect.anything() });
  });

  describe("on 1 January", () => {
    beforeEach(() => void vi.useFakeTimers({ toFake: ["Date"], now: new Date("2031-01-01T06:30:00.000Z") }));
    afterEach(() => void vi.useRealTimers());

    it("31 December takes last year's series, and the suggested numbers follow the date", async () => {
      const { createBooking, suggestInvoiceNumbers } = await import("../bookings/service");
      expect(await suggestInvoiceNumbers()).toEqual({ "01/01/2031": "INV_20310143", "31/12/2030": "INV_20300143" });
      const lastYear = await createBooking({ ...draft(), invoiceDate: "31/12/2030" });
      const thisYear = await createBooking(draft());
      expect([lastYear.invoiceNumber, thisYear.invoiceNumber]).toEqual(["INV_20300143", "INV_20310143"]);
      expect(await suggestInvoiceNumbers()).toEqual({ "01/01/2031": "INV_20310144", "31/12/2030": "INV_20300144" });
    });
  });
});

describe("Closed by", () => {
  const closedByError = (err: { fieldErrors?: Record<string, string> }) => err.fieldErrors?.closedById;

  it("stores the team member's ID and name at the time, however they're renamed later", async () => {
    const { createBooking, getBooking } = await import("../bookings/service");
    const { updateTeamMember, getTeamMember } = await import("../team/service");
    const a = await createBooking(draft());
    expect(a.closedBy).toEqual({ refId: LIST_IDS.member, label: "Ravi Kumar" });
    await updateTeamMember(LIST_IDS.member, { name: "Ravi K" }, (await getTeamMember(LIST_IDS.member)).updatedAt);
    expect((await getBooking(a.bookingId)).closedBy?.label).toBe("Ravi Kumar");
  });

  it("is required, and must be an active team member", async () => {
    const { createBooking } = await import("../bookings/service");
    const { archiveTeamMember, getTeamMember } = await import("../team/service");
    const { closedById, ...withoutIt } = draft();
    void closedById;
    expect(await createBooking(withoutIt).catch(closedByError)).toBe("Choose who closed this booking.");
    expect(await createBooking({ ...draft(), closedById: crypto.randomUUID() }).catch(closedByError)).toBe("Pick who closed this booking from the team.");
    await archiveTeamMember(LIST_IDS.member, (await getTeamMember(LIST_IDS.member)).updatedAt);
    expect(await createBooking(draft()).catch(closedByError)).toBe("Pick who closed this booking from the team.");
  });

  it("can be changed; an archived one stays on an unrelated edit, and can't be newly picked", async () => {
    const { createBooking, updateBooking, getBooking } = await import("../bookings/service");
    const { archiveTeamMember, createTeamMember, getTeamMember } = await import("../team/service");
    const a = await createBooking(draft());
    const other = await createTeamMember({ name: "Sana", role: "Sales", phone: "" });

    const b = await updateBooking(a.bookingId, { closedById: other.id }, a.updatedAt);
    expect(b.closedBy).toEqual({ refId: other.id, label: "Sana" });

    await archiveTeamMember(other.id, (await getTeamMember(other.id)).updatedAt);
    const c = await updateBooking(a.bookingId, { closedById: other.id, batchName: "Batch B" }, b.updatedAt);
    expect(c.closedBy?.label).toBe("Sana");
    await archiveTeamMember(LIST_IDS.member, (await getTeamMember(LIST_IDS.member)).updatedAt);
    expect(await updateBooking(a.bookingId, { closedById: LIST_IDS.member }, c.updatedAt).catch(closedByError)).toBe("Pick who closed this booking from the team.");
    expect((await getBooking(a.bookingId)).closedBy?.label).toBe("Sana");
  });

  it("an older booking without one reads as null, must get one on its next edit, and can still be cancelled", async () => {
    const { getBooking, updateBooking, setBookingStatus } = await import("../bookings/service");
    const id = crypto.randomUUID();
    const trip = { closedBy: null, tripStartDate: addDays(todayIST(), 40), tripEndDate: addDays(todayIST(), 42) };
    const older = crypto.randomUUID();
    await seed([booking({ ...trip, bookingId: id }), booking({ ...trip, bookingId: older, invoiceNumber: "INV_20260144" })]);
    const old = await getBooking(id);
    expect(old.closedBy).toBeNull();
    expect(await updateBooking(id, { batchName: "Batch B" }, old.updatedAt).catch(closedByError)).toBe("Choose who closed this booking.");
    const picked = await updateBooking(id, { batchName: "Batch B", closedById: LIST_IDS.member }, old.updatedAt);
    expect(picked.closedBy?.label).toBe("Ravi Kumar");

    const cancelled = await setBookingStatus(older, "Cancelled", (await getBooking(older)).updatedAt);
    expect(cancelled.bookingStatus).toBe("Cancelled");
  });

  it("can change on a cancelled booking, adds no history row, and isn't on the bill", async () => {
    const { createBooking, setBookingStatus, updateBooking, getBooking, getBookingHistory } = await import("../bookings/service");
    const { createTeamMember } = await import("../team/service");
    const { bookingHistoryCollection } = await import("./collections");
    const a = await createBooking(draft());
    const cancelled = await setBookingStatus(a.bookingId, "Cancelled", a.updatedAt);
    const rowsBefore = (await getBookingHistory(a.bookingId)).length;
    const other = await createTeamMember({ name: "Sana", role: "Sales", phone: "" });
    await updateBooking(a.bookingId, { closedById: other.id }, cancelled.updatedAt);
    expect((await getBooking(a.bookingId)).closedBy?.label).toBe("Sana");
    expect(await getBookingHistory(a.bookingId)).toHaveLength(rowsBefore);
    const rows = await (await bookingHistoryCollection()).find({ bookingId: a.bookingId }).toArray();
    for (const row of rows) expect(row.bill).not.toHaveProperty("closedBy");
  });
});

describe("the Closed by filter", () => {
  const SANA = "66666666-6666-4666-8666-666666666666";
  const ledger = async (params: Record<string, string>) => {
    const { getBookingLedger } = await import("../bookings/service");
    return getBookingLedger(parseBookingFilters(params));
  };
  const sana = { refId: SANA, label: "Sana" };

  beforeEach(() =>
    seed([
      booking({ bookingId: "a", invoiceNumber: "INV_1", createdAt: "2026-01-03T00:00:00.000Z", totalAmount: 1_000 }),
      booking({ bookingId: "b", invoiceNumber: "INV_2", createdAt: "2026-01-02T00:00:00.000Z", totalAmount: 2_000, closedBy: sana }),
      booking({ bookingId: "c", invoiceNumber: "INV_3", createdAt: "2026-01-01T00:00:00.000Z", totalAmount: 4_000, closedBy: null }),
      booking({ bookingId: "d", invoiceNumber: "INV_4", createdAt: "2025-12-31T00:00:00.000Z", totalAmount: 8_000, closedBy: sana, bookingStatus: "Archived" }),
    ])
  );

  it("keeps only that person's bookings, and the totals row follows while the tiles don't", async () => {
    const all = await ledger({});
    const one = await ledger({ closedBy: SANA });
    expect(one.items.map((r) => r.bookingId)).toEqual(["b"]);
    expect(one.items[0].closedBy).toEqual(sana);
    expect(one.totals).toMatchObject({ count: 1, activeTotal: 2_000 });
    expect(one.summary).toEqual(all.summary);
  });

  it("shows an older booking with no one, which no person's filter finds", async () => {
    expect((await ledger({})).items.find((r) => r.bookingId === "c")?.closedBy).toBeNull();
    expect((await ledger({ closedBy: LIST_IDS.member })).items.map((r) => r.bookingId)).toEqual(["a"]);
  });

  it("works in the archived view", async () => {
    expect((await ledger({ closedBy: SANA, archived: "1" })).items.map((r) => r.bookingId)).toEqual(["d"]);
  });

  it("ignores a value that isn't an ID", () => {
    expect(parseBookingFilters({ closedBy: "nonsense" }).closedBy).toBe("");
    expect(parseBookingFilters({ closedBy: SANA }).closedBy).toBe(SANA);
  });

  it("stays in the page links, and counts as a filter", async () => {
    const { bookingFilterParams, hasActiveFilters } = await import("@/lib/domain/filters");
    const filters = parseBookingFilters({ closedBy: SANA });
    expect(bookingFilterParams(filters).closedBy).toBe(SANA);
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("never sorts in memory, alone or with a destination or date", async () => {
    const { bookingsCollection } = await import("./collections");
    const { ledgerHint, ledgerMatch } = await import("./ledger-query");
    for (const extra of [{}, { destination: "Delhi" }, { from: "2026-01-01" }, { booked: "2026-01-05" }, { status: "Active" }, { archived: "1" }]) {
      const filters = parseBookingFilters({ closedBy: SANA, ...extra });
      const hint = ledgerHint(filters);
      const plan = await (await bookingsCollection())
        .find(ledgerMatch(filters, "10/01/2026"), hint ? { hint } : {})
        .sort({ createdAt: -1, _id: 1 })
        .limit(15)
        .explain("queryPlanner");
      const stages = stagesOf((plan as Document).queryPlanner.winningPlan);
      expect(stages).not.toContain("SORT");
      expect(stages).not.toContain("COLLSCAN");
    }
  });

  it("offers the whole team: active first, then archived, each by name", async () => {
    const { archiveTeamMember, createTeamMember, getTeamFilterOptions, getTeamMember } = await import("../team/service");
    const zoya = await createTeamMember({ name: "Zoya", role: "", phone: "" });
    const asha = await createTeamMember({ name: "Asha", role: "", phone: "" });
    await archiveTeamMember(asha.id, (await getTeamMember(asha.id)).updatedAt);
    expect(Object.entries(await getTeamFilterOptions())).toEqual([
      [LIST_IDS.member, "Ravi Kumar"],
      [zoya.id, "Zoya"],
      [asha.id, "Asha · Archived"],
    ]);
  });
});
