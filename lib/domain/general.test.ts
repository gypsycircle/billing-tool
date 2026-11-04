import { describe, expect, it } from "vitest";
import { ROUTE_OTHER, routeChoices, routeFormValues } from "./general";

const LIST = ["Agra-Delhi", "Dehradun to Dehradun"];

describe("the Route dropdown", () => {
  it("offers the list, then Other", () => {
    expect(Object.keys(routeChoices(LIST))).toEqual([...LIST, ROUTE_OTHER]);
    expect(Object.keys(routeChoices([]))).toEqual([ROUTE_OTHER]);
    expect(routeChoices([], ROUTE_OTHER)).toEqual({ [ROUTE_OTHER]: "Other (type the route)" });
  });

  it("keeps a listed route's saved spelling", () => {
    expect(routeChoices(LIST, "agra-delhi")).toMatchObject({ "agra-delhi": "Agra-Delhi" });
    expect(routeFormValues("agra-delhi", LIST)).toEqual({ routeDescription: "agra-delhi", routeOther: "" });
  });

  it("opens a route not in the list as Other with its text, and none as nothing chosen", () => {
    expect(routeFormValues("Kochi-Munnar", LIST)).toEqual({ routeDescription: ROUTE_OTHER, routeOther: "Kochi-Munnar" });
    expect(routeFormValues("", LIST)).toEqual({ routeDescription: "", routeOther: "" });
  });
});
