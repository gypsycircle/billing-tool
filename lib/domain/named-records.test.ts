import { describe, expect, it } from "vitest";
import { bookingListChoices } from "./general";
import { generalItemDraftSchema, updateGeneralItemSchema } from "./general.schema";
import { nameKeyOf, namedRefOf } from "./named-records";
import { teamMemberDraftSchema, updateTeamMemberSchema } from "./team.schema";

describe("nameKeyOf", () => {
  it("ignores case, outer and repeated spaces", () => {
    expect(nameKeyOf("  Goa  Beach   Camp ")).toBe("goa beach camp");
    expect(nameKeyOf("RAVI kumar")).toBe(nameKeyOf("Ravi Kumar"));
  });
});

describe("team member schemas", () => {
  it("needs a name; role and phone are optional", () => {
    expect(teamMemberDraftSchema.parse({ name: " Ravi " })).toEqual({ name: "Ravi", role: "", phone: "" });
    expect(teamMemberDraftSchema.safeParse({ name: "Ravi", phone: "98470 12345" }).success).toBe(true);
    expect(teamMemberDraftSchema.safeParse({ name: "Ravi", phone: "123" }).success).toBe(false);
    expect(teamMemberDraftSchema.safeParse({ name: "Ravi", role: "x".repeat(51) }).success).toBe(false);
  });

  it("edits only name, role and phone", () => {
    expect(updateTeamMemberSchema.parse({ role: "Guide" })).toEqual({ role: "Guide" });
    expect(updateTeamMemberSchema.safeParse({ status: "Archived" }).success).toBe(false);
    expect(updateTeamMemberSchema.safeParse({}).success).toBe(false);
  });
});

describe("list item schemas", () => {
  it("checks the name against its list's length", () => {
    expect(generalItemDraftSchema.parse({ kind: "destination", name: " Goa " })).toEqual({ kind: "destination", name: "Goa" });
    expect(generalItemDraftSchema.safeParse({ kind: "destination", name: "x".repeat(101) }).success).toBe(false);
    expect(generalItemDraftSchema.safeParse({ kind: "route", name: "x".repeat(200) }).success).toBe(true);
    const unknown = generalItemDraftSchema.safeParse({ kind: "hotel", name: "x" });
    expect(unknown.error?.issues[0]).toMatchObject({ path: ["kind"], message: "Choose a list." });
  });

  it("edits only the name", () => {
    expect(updateGeneralItemSchema.safeParse({ name: "Goa" }).success).toBe(true);
    expect(updateGeneralItemSchema.safeParse({ name: "Goa", kind: "route" }).success).toBe(false);
  });
});

describe("namedRefOf", () => {
  it("keeps only the reference", () => {
    expect(namedRefOf({ id: "1", name: "Goa", status: "Active", updatedAt: "t", createdAt: "c", kind: "destination" } as never)).toEqual({ id: "1", name: "Goa", status: "Active", updatedAt: "t" });
  });
});

describe("bookingListChoices", () => {
  const names = ["Goa", "Munnar"];

  it("offers the list's names, keyed by the name the booking stores", () => {
    expect(bookingListChoices(names)).toEqual({ Goa: "Goa", Munnar: "Munnar" });
  });

  it("keeps a saved value's own spelling, so an unchanged field saves unchanged", () => {
    expect(bookingListChoices(names, "goa ")).toEqual({ "goa ": "Goa", Munnar: "Munnar" });
  });

  it("still offers a saved value no longer in the list, marked", () => {
    expect(bookingListChoices(names, "Mumbai")).toEqual({ Goa: "Goa", Munnar: "Munnar", Mumbai: "Mumbai · Not in the list" });
  });
});
