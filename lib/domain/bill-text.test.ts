import { describe, expect, it } from "vitest";
import { discountPercentLabel, quantityLabel, serviceDescription } from "./bill-text";

describe("bill text", () => {
  it("matches the sample bill's service line", () => {
    expect(
      serviceDescription({
        tripStartDate: "19/01/2026",
        tripEndDate: "24/01/2026",
        routeDescription: "Agra-delhi-Manali-Kasol",
      })
    ).toBe("Starts from 19th jan 2026 and ends at 24th jan 2026 ( Agra-delhi-Manali-Kasol )");
  });

  it("omits the brackets when there is no route", () => {
    expect(serviceDescription({ tripStartDate: "01/03/2026", tripEndDate: "03/03/2026", routeDescription: "  " })).toBe(
      "Starts from 1st mar 2026 and ends at 3rd mar 2026"
    );
  });

  it("formats quantity and discount percentage", () => {
    expect(quantityLabel(40)).toBe("40 PERSON");
    expect(discountPercentLabel(12.5)).toBe("(12.5%)");
  });
});
