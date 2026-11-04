// Team members and list items against a real (in-memory) MongoDB: creates,
// unique names (per list), idempotency, versioned edits, archive / restore,
// the dropdowns and Settings lists, and the indexes behind them.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "mongodb";
import { setUpTestDatabase, stagesOf } from "./test-database";

vi.mock("../guards", () => ({ verifySession: async () => {}, requireSessionOrRedirect: async () => {} }));

const { clear } = setUpTestDatabase("named_test");
beforeEach(async () => {
  await clear();
  // The Roles list the team form picks from
  const { createGeneralItem } = await import("../general/service");
  for (const name of ["Guide", "Sales"]) await createGeneralItem({ kind: "role", name });
});

const team = () => import("../team/service");
const general = () => import("../general/service");
const fieldErrorsOf = (promise: Promise<unknown>) => promise.then(() => null, (err) => err.fieldErrors ?? err.name);

describe("team members", () => {
  it("adds them with an optional phone", async () => {
    const { createTeamMember, getTeamMember } = await team();
    const a = await createTeamMember({ name: "  Ravi Kumar ", role: "Guide", phone: "+91 98470 12345" });
    const b = await createTeamMember({ name: "Anu", role: "sales" });
    expect([a.name, a.role, a.status, b.role, b.phone]).toEqual(["Ravi Kumar", "Guide", "Active", "Sales", ""]);
    expect(await getTeamMember(a.id)).toEqual(a);
  });

  it("checks the name, role and phone", async () => {
    const { createTeamMember } = await team();
    expect(await fieldErrorsOf(createTeamMember({ name: "", role: "Guide" }))).toEqual({ name: "Name is required." });
    expect(await fieldErrorsOf(createTeamMember({ name: "x".repeat(81), role: "Guide" }))).toEqual({ name: expect.stringMatching(/at most 80/) });
    expect(await fieldErrorsOf(createTeamMember({ name: "=cmd", role: "Guide" }))).toEqual({ name: expect.stringMatching(/can't start with/) });
    expect(await fieldErrorsOf(createTeamMember({ name: "Ravi", role: "Guide", phone: "12ab" }))).toEqual({ phone: expect.stringMatching(/7–15 digits/) });
    for (const role of [undefined, "", "  "]) expect(await fieldErrorsOf(createTeamMember({ name: "Ravi", role }))).toEqual({ role: "Role is required." });
    expect(await fieldErrorsOf(createTeamMember({ name: "Ravi", role: "Pilot" }))).toEqual({ role: expect.stringMatching(/Pick a role/) });
  });

  it("someone saved with no role stays listed and gets one on their next edit; an older role no longer listed stays", async () => {
    const { getTeamMember, getTeamPage, updateTeamMember } = await team();
    const { usersCollection } = await import("./collections");
    const now = new Date();
    const person = (name: string, role: string) => ({ _id: crypto.randomUUID(), name, nameKey: name.toLowerCase(), role, phone: "", status: "Active" as const, createdAt: now, updatedAt: now });
    const [noRole, oldRole] = [person("Older", ""), person("Tech Person", "Tech")];
    await (await usersCollection()).insertMany([noRole, oldRole]);
    expect((await getTeamPage(1, { q: "", role: "", archived: false })).items.map((m) => m.name).sort()).toEqual(["Older", "Tech Person"]);
    const saved = await getTeamMember(noRole._id);
    await expect(updateTeamMember(noRole._id, { phone: "9847012345" }, saved.updatedAt)).rejects.toMatchObject({ fieldErrors: { role: "Role is required." } });
    expect((await updateTeamMember(noRole._id, { role: "Guide" }, saved.updatedAt)).role).toBe("Guide");
    const tech = await getTeamMember(oldRole._id);
    expect((await updateTeamMember(oldRole._id, { phone: "9847012345" }, tech.updatedAt)).role).toBe("Tech");
  });

  it("refuses a name already used, whatever its case or spacing, even by an archived member", async () => {
    const { archiveTeamMember, createTeamMember } = await team();
    const a = await createTeamMember({ name: "Ravi Kumar", role: "Guide" });
    await expect(createTeamMember({ name: "ravi   KUMAR", role: "Guide" })).rejects.toMatchObject({ name: "DuplicateNameError", message: expect.stringMatching(/team member called "ravi {3}KUMAR"/) });
    await archiveTeamMember(a.id, a.updatedAt);
    await expect(createTeamMember({ name: "Ravi Kumar", role: "Guide" })).rejects.toMatchObject({ name: "DuplicateNameError" });
  });

  it("returns the first member for a repeated idempotency key", async () => {
    const { createTeamMember, getTeamList } = await team();
    const key = "team-key-1234567890";
    const [a, b] = await Promise.all([createTeamMember({ name: "Anu", role: "Guide" }, key), createTeamMember({ name: "Anu", role: "Guide" }, key)]);
    expect(b.id).toBe(a.id);
    expect(await getTeamList()).toHaveLength(1);
  });

  it("edits at the version on screen: 404, 428, 412, and a renamed duplicate is refused", async () => {
    const { createTeamMember, updateTeamMember } = await team();
    const a = await createTeamMember({ name: "Ravi", role: "Guide" });
    await createTeamMember({ name: "Anu", role: "Guide" });
    const b = await updateTeamMember(a.id, { role: "Sales" }, a.updatedAt);
    expect([b.name, b.role, b.updatedAt > a.updatedAt]).toEqual(["Ravi", "Sales", true]);
    await expect(updateTeamMember(crypto.randomUUID(), { role: "x" }, b.updatedAt)).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(updateTeamMember(a.id, { role: "x" }, "")).rejects.toMatchObject({ name: "MissingVersionError" });
    await expect(updateTeamMember(a.id, { role: "x" }, a.updatedAt)).rejects.toMatchObject({ name: "StaleRecordError" });
    await expect(updateTeamMember(a.id, { name: "anu" }, b.updatedAt)).rejects.toMatchObject({ name: "DuplicateNameError" });
    await expect(updateTeamMember(a.id, { status: "Archived" }, b.updatedAt)).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("archives and restores; archived members are read-only and leave the dropdown", async () => {
    const { archiveTeamMember, createTeamMember, getTeamList, getTeamOptions, setTeamMemberStatus, updateTeamMember } = await team();
    const ravi = await createTeamMember({ name: "Ravi", role: "Guide" });
    await createTeamMember({ name: "anu", role: "Guide" });
    expect(await getTeamOptions()).toEqual([
      { id: expect.any(String), name: "anu", detail: "Guide" },
      { id: ravi.id, name: "Ravi", detail: "Guide" },
    ]);
    const archived = await archiveTeamMember(ravi.id, ravi.updatedAt);
    expect(archived.status).toBe("Archived");
    expect((await getTeamOptions()).map((o) => o.name)).toEqual(["anu"]);
    expect((await getTeamList()).map((m) => [m.name, m.status])).toEqual([["anu", "Active"], ["Ravi", "Archived"]]);
    await expect(updateTeamMember(ravi.id, { role: "x" }, archived.updatedAt)).rejects.toMatchObject({ name: "ArchivedRecordError" });
    expect((await setTeamMemberStatus(ravi.id, "Active", archived.updatedAt)).status).toBe("Active");
  });
});

describe("a PATCH (change)", () => {
  it("restores on { status: \"Active\" } alone, edits otherwise, and answers the reference", async () => {
    const { archiveTeamMember, changeTeamMember, createTeamMember } = await team();
    const ravi = await createTeamMember({ name: "Ravi", role: "Guide" });
    const archived = await archiveTeamMember(ravi.id, ravi.updatedAt);
    const restored = await changeTeamMember(ravi.id, { status: "Active" }, archived.updatedAt);
    expect(restored).toMatchObject({ id: ravi.id, status: "Active" });
    const edited = await changeTeamMember(ravi.id, { role: "Sales" }, restored.updatedAt);
    expect(edited).toMatchObject({ role: "Sales", status: "Active" });
    await expect(changeTeamMember(ravi.id, { status: "Archived" }, edited.updatedAt)).rejects.toMatchObject({ name: "ValidationError" });
    await expect(changeTeamMember(crypto.randomUUID(), { status: "Active" }, "")).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(changeTeamMember(ravi.id, { status: "Active" }, "")).rejects.toMatchObject({ name: "MissingVersionError" });
  });
});

describe("list items", () => {
  it("keeps names unique within a list, but not across lists", async () => {
    const { createGeneralItem } = await general();
    await createGeneralItem({ kind: "destination", name: "Goa" });
    await expect(createGeneralItem({ kind: "destination", name: " GOA " })).rejects.toMatchObject({ name: "DuplicateNameError", message: expect.stringMatching(/destination called/) });
    expect((await createGeneralItem({ kind: "package", name: "Goa" })).kind).toBe("package");
  });

  it("limits each list's names to its booking field's length", async () => {
    const { createGeneralItem } = await general();
    expect(await fieldErrorsOf(createGeneralItem({ kind: "destination", name: "x".repeat(101) }))).toEqual({ name: expect.stringMatching(/at most 100/) });
    expect((await createGeneralItem({ kind: "route", name: "x".repeat(200) })).name).toHaveLength(200);
    expect(await fieldErrorsOf(createGeneralItem({ kind: "hotel", name: "x" }))).toEqual({ kind: "Choose a list." });
  });

  it("renames (only the name) and archives; each list has its own dropdown", async () => {
    const { archiveGeneralItem, createGeneralItem, getGeneralList, getGeneralOptions, updateGeneralItem } = await general();
    const meta = await createGeneralItem({ kind: "marketing", name: "Meta Ads" });
    await createGeneralItem({ kind: "marketing", name: "Google Ads" });
    await createGeneralItem({ kind: "destination", name: "Goa" });
    const renamed = await updateGeneralItem(meta.id, { name: "Meta (Facebook) Ads" }, meta.updatedAt);
    expect([renamed.name, renamed.kind]).toEqual(["Meta (Facebook) Ads", "marketing"]);
    await expect(updateGeneralItem(meta.id, { kind: "destination" }, renamed.updatedAt)).rejects.toMatchObject({ name: "ValidationError" });
    expect((await getGeneralOptions("marketing")).map((o) => o.name)).toEqual(["Google Ads", "Meta (Facebook) Ads"]);
    await archiveGeneralItem(meta.id, renamed.updatedAt);
    expect((await getGeneralOptions("marketing")).map((o) => o.name)).toEqual(["Google Ads"]);
    expect((await getGeneralList({ kind: "marketing" })).map((i) => i.status)).toEqual(["Active", "Archived"]);
    expect((await getGeneralList({ kind: "destination" })).map((i) => i.name)).toEqual(["Goa"]);
  });

  it("finds active names for bookings, in the list's own spelling", async () => {
    const { activeListNames, archiveGeneralItem, createGeneralItem } = await general();
    await createGeneralItem({ kind: "destination", name: "Goa" });
    const munnar = await createGeneralItem({ kind: "destination", name: "Munnar" });
    await createGeneralItem({ kind: "package", name: "Goa Beach Camp" });
    await archiveGeneralItem(munnar.id, munnar.updatedAt);
    expect(await activeListNames({ destination: " goa", package: "GOA BEACH CAMP", route: "" })).toEqual({ destination: "Goa", package: "Goa Beach Camp" });
    expect(await activeListNames({ destination: "Munnar", package: "Goa" })).toEqual({});
  });
});

describe("the Settings pages", () => {
  // The team is newest first: give each create its own millisecond
  const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

  it("pages the team five at a time, newest first, and clamps a page past the end", async () => {
    const { createTeamMember, getTeamPage } = await team();
    for (const name of ["Anu", "Bala", "Chitra", "Dev", "Esha", "Farah", "Gopi"]) {
      await createTeamMember({ name, role: "Guide" });
      await tick();
    }
    const first = await getTeamPage(1, { q: "", role: "", archived: false });
    expect(first.items.map((m) => m.name)).toEqual(["Gopi", "Farah", "Esha", "Dev", "Chitra"]);
    expect([first.page, first.pageCount, first.from, first.to, first.total, first.empty]).toEqual([1, 2, 1, 5, 7, false]);
    const last = await getTeamPage(9, { q: "", role: "", archived: false });
    expect([last.page, last.from, last.to, last.items.map((m) => m.name)]).toEqual([2, 6, 7, ["Bala", "Anu"]]);
  });

  it("shows the active team or the archived view, and searches name, role and phone", async () => {
    const { archiveTeamMember, createTeamMember, getTeamPage } = await team();
    expect((await getTeamPage(1, { q: "", role: "", archived: false })).empty).toBe(true);
    const anu = await createTeamMember({ name: "Anu", role: "Guide", phone: "9876543210" });
    await tick();
    await createTeamMember({ name: "Bala", role: "Sales" });
    await tick();
    await createTeamMember({ name: "Chitra (a.k.a. C)", role: "Guide" });
    await archiveTeamMember(anu.id, anu.updatedAt);
    const names = async (q: string, archived: boolean) => (await getTeamPage(1, { q, role: "", archived })).items.map((m) => m.name);
    expect(await names("", false)).toEqual(["Chitra (a.k.a. C)", "Bala"]);
    expect(await names("", true)).toEqual(["Anu"]);
    expect(await names("guide", false)).toEqual(["Chitra (a.k.a. C)"]);
    expect(await names("guide", true)).toEqual(["Anu"]);
    expect(await names("54321", true)).toEqual(["Anu"]);
    expect(await names("(a.k.a.", false)).toEqual(["Chitra (a.k.a. C)"]); // taken literally, not as a pattern
    const none = await getTeamPage(1, { q: "nobody", role: "", archived: false });
    expect([none.total, none.empty]).toEqual([0, false]);
  });

  it("filters the team by role, in any capitalisation, with the search and archived view, and offers every role", async () => {
    const { archiveGeneralItem, createGeneralItem } = await general();
    const { archiveTeamMember, createTeamMember, getRoleFilterOptions, getTeamPage } = await team();
    const old = await createGeneralItem({ kind: "role", name: "Tech" });
    const asha = await createTeamMember({ name: "Asha", role: "Sales" });
    await createTeamMember({ name: "Bala", role: "Sales" });
    await createTeamMember({ name: "Chitra", role: "Guide" });
    await createTeamMember({ name: "Dev", role: "Guide" });
    await archiveTeamMember(asha.id, asha.updatedAt);
    const names = async (role: string, q = "", archived = false) => (await getTeamPage(1, { q, role, archived })).items.map((m) => m.name);
    expect(await names("sales")).toEqual(["Bala"]);
    expect(await names("Sales", "", true)).toEqual(["Asha"]);
    expect(await names("Guide", "bala")).toEqual([]);
    expect(await names("Sa.es")).toEqual([]); // taken literally, not as a pattern

    // A role no longer in the list stays findable: Tech is archived; SMM was removed from the list
    await archiveGeneralItem(old.id, old.updatedAt);
    const { usersCollection } = await import("./collections");
    await (await usersCollection()).updateOne({ name: "Dev" }, { $set: { role: "SMM" } });
    expect(Object.entries(await getRoleFilterOptions())).toEqual([["Guide", "Guide"], ["Sales", "Sales"], ["SMM", "SMM"], ["Tech", "Tech · Archived"]]);
  });

  it("pages one list at a time by name, its archived items apart, and counts each list's active items", async () => {
    const { archiveGeneralItem, createGeneralItem, getGeneralActiveCounts, getGeneralListPage } = await general();
    for (const name of ["F", "B", "A", "D", "C", "E"]) await createGeneralItem({ kind: "package", name });
    const goa = await createGeneralItem({ kind: "destination", name: "Goa" });
    await createGeneralItem({ kind: "destination", name: "Munnar" });
    await archiveGeneralItem(goa.id, goa.updatedAt);
    const second = await getGeneralListPage("package", 2, { q: "", archived: false });
    expect([second.items.map((i) => i.name), second.total]).toEqual([["F"], 6]);
    expect((await getGeneralListPage("destination", 1, { q: "", archived: false })).items.map((i) => i.name)).toEqual(["Munnar"]);
    expect((await getGeneralListPage("destination", 1, { q: "", archived: true })).items.map((i) => i.name)).toEqual(["Goa"]);
    const routes = await getGeneralListPage("route", 1, { q: "", archived: false });
    expect([routes.total, routes.empty]).toEqual([0, true]);
    // A list whose items are all archived isn't empty: they can be restored
    const kochi = await createGeneralItem({ kind: "route", name: "Kochi" });
    await archiveGeneralItem(kochi.id, kochi.updatedAt);
    const allArchived = await getGeneralListPage("route", 1, { q: "", archived: false });
    expect([allArchived.total, allArchived.empty]).toEqual([0, false]);
    expect(await getGeneralActiveCounts()).toEqual({ destination: 1, package: 6, route: 0, marketing: 0, role: 2 });
  });

  it("searches inside the open list only, active or archived", async () => {
    const { archiveGeneralItem, createGeneralItem, getGeneralListPage } = await general();
    await createGeneralItem({ kind: "destination", name: "Goa (North)" });
    await createGeneralItem({ kind: "package", name: "Goa Beach Camp" });
    const old = await createGeneralItem({ kind: "destination", name: "Old Goa" });
    await archiveGeneralItem(old.id, old.updatedAt);
    const names = async (q: string, archived = false) => (await getGeneralListPage("destination", 1, { q, archived })).items.map((i) => i.name);
    expect(await names("GOA")).toEqual(["Goa (North)"]);
    expect(await names("goa", true)).toEqual(["Old Goa"]);
    expect(await names("(north)")).toEqual(["Goa (North)"]);
    const none = await getGeneralListPage("destination", 1, { q: "beach", archived: false });
    expect([none.total, none.empty]).toEqual([0, false]);
  });
});

describe("the indexes behind the dropdowns and Settings lists", () => {
  async function plan(collection: "users" | "general", filter: Document, sort: Document) {
    const { getDb } = await import("./client");
    return stagesOf((await (await getDb()).collection(collection).find(filter).sort(sort).explain("queryPlanner")).queryPlanner.winningPlan);
  }

  it.each([
    ["the Salary dropdown", "users", { status: "Active" }, { nameKey: 1 }],
    ["the team in Settings", "users", { status: "Archived" }, { createdAt: -1, _id: 1 }],
    ["the team for the API", "users", {}, { status: 1, createdAt: -1, _id: 1 }],
    ["a list's dropdown", "general", { kind: "package", status: "Active" }, { nameKey: 1 }],
    ["a list in Settings", "general", { kind: "package", status: "Archived" }, { nameKey: 1 }],
    ["a list for the API", "general", { kind: "package" }, { status: 1, nameKey: 1 }],
  ] as const)("reads %s straight off an index, with no in-memory sort", async (_label, collection, filter, sort) => {
    const { createTeamMember } = await team();
    const { createGeneralItem } = await general();
    await createTeamMember({ name: "Ravi", role: "Guide" });
    await createGeneralItem({ kind: "package", name: "Goa" });
    const stages = await plan(collection, filter, sort);
    expect(stages).toContain("IXSCAN");
    expect(stages).not.toContain("SORT");
    expect(stages).not.toContain("COLLSCAN");
  });
});

describe("the collections", () => {
  it("refuse a bad status or list at the database too", async () => {
    const { generalCollection, usersCollection } = await import("./collections");
    const base = { _id: crypto.randomUUID(), name: "X", nameKey: "x", status: "Active", createdAt: new Date(), updatedAt: new Date() };
    await expect((await usersCollection()).insertOne({ ...base, role: "", phone: "", status: "Gone" } as never)).rejects.toThrow(/validation/i);
    await expect((await generalCollection()).insertOne({ ...base, kind: "hotel" } as never)).rejects.toThrow(/validation/i);
  });
});
