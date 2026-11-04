import { describe, expect, it } from "vitest";
import { parseSettingsFilters, settingsHref, settingsParams } from "./settings-filters";

describe("parseSettingsFilters", () => {
  it("defaults to the active team and Destinations, page 1", () => {
    expect(parseSettingsFilters({})).toEqual({ teamSearch: "", teamRole: "", teamArchived: false, teamPage: 1, list: "destination", listSearch: "", listArchived: false, listPage: 1 });
  });

  it("reads each section's own parameters and drops bad ones", () => {
    const parsed = parseSettingsFilters({ teamSearch: "  guide ", teamRole: " Sales ", teamArchived: "1", teamPage: "2", list: "hotel", listSearch: " goa ", listArchived: "yes", listPage: "-3" });
    expect(parsed).toEqual({ teamSearch: "guide", teamRole: "Sales", teamArchived: true, teamPage: 2, list: "destination", listSearch: "goa", listArchived: false, listPage: 1 });
  });
});

describe("settingsHref", () => {
  it("keeps the list's search", () => {
    expect(settingsHref(parseSettingsFilters({ list: "route", listSearch: "kochi" }), "lists")).toBe("/settings?list=route&listSearch=kochi#lists");
  });

  it("keeps only what is set, and lands on the section", () => {
    const state = parseSettingsFilters({ list: "package", listArchived: "1", teamPage: "2" });
    expect(settingsParams(state)).toMatchObject({ list: "package", listArchived: "1", teamPage: "2", teamSearch: "" });
    expect(settingsHref({ ...state, listArchived: false }, "lists")).toBe("/settings?teamPage=2&list=package#lists");
    expect(settingsHref(parseSettingsFilters({}), "team")).toBe("/settings#team");
  });
});
