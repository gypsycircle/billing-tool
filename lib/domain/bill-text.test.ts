import { describe, expect, it } from "vitest";
import { billFileName, discountPercentLabel, quantityLabel, serviceDescription } from "./bill-text";

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

describe("billFileName", () => {
  const name = (customerName: string, packageName = "WINTER SPITI", tripStartDate = "26/12/2026") => billFileName({ customerName, tripStartDate, packageName });

  it("is customer-start date-package", () => {
    expect(name("Afraq")).toBe("Afraq-26-12-2026-WINTER-SPITI.pdf");
    expect(name("Ravi Kumar", "Delhi - Agra Package")).toBe("Ravi-Kumar-26-12-2026-Delhi-Agra-Package.pdf");
  });

  it("simplifies accents and drops what a file name or header can't hold", () => {
    expect(name("José Ñandú")).toBe("Jose-Nandu-26-12-2026-WINTER-SPITI.pdf");
    expect(name('A/B\\C"D:E\r\nF')).toBe("A-B-C-D-E-F-26-12-2026-WINTER-SPITI.pdf");
    expect(name("Ravi 😀")).toBe("Ravi-26-12-2026-WINTER-SPITI.pdf");
  });

  it("skips a part left empty, and always has a name", () => {
    expect(name("😀")).toBe("26-12-2026-WINTER-SPITI.pdf");
    expect(billFileName({ customerName: "😀", tripStartDate: "", packageName: "!!" })).toBe("Bill-of-Supply.pdf");
  });

  it("limits a very long name", () => {
    const long = name("x".repeat(300), "y".repeat(300));
    expect(long).toBe(`${"x".repeat(60)}-26-12-2026-${"y".repeat(60)}.pdf`);
  });
});
