import { describe, expect, it } from "vitest";
import {
  addDays,
  defaultDueDate,
  formatDisplayDate,
  formatTimestampIST,
  formatTripDate,
  fromISODate,
  isValidDDMMYYYY,
  toISODate,
  todayIST,
} from "./dates";

describe("isValidDDMMYYYY", () => {
  it.each(["13/01/2026", "29/02/2024", "31/12/2026", "01/01/2000"])("accepts %s", (value) => {
    expect(isValidDDMMYYYY(value)).toBe(true);
  });

  it.each(["31/02/2026", "29/02/2026", "00/01/2026", "13/13/2026", "1/1/2026", "2026-01-13", ""])(
    "rejects %s",
    (value) => {
      expect(isValidDDMMYYYY(value)).toBe(false);
    }
  );
});

describe("formatTripDate", () => {
  it.each([
    ["19/01/2026", "19th jan 2026"],
    ["24/01/2026", "24th jan 2026"],
    ["01/03/2026", "1st mar 2026"],
    ["02/03/2026", "2nd mar 2026"],
    ["03/03/2026", "3rd mar 2026"],
    ["11/03/2026", "11th mar 2026"],
    ["12/03/2026", "12th mar 2026"],
    ["13/03/2026", "13th mar 2026"],
    ["21/12/2026", "21st dec 2026"],
    ["22/12/2026", "22nd dec 2026"],
    ["23/12/2026", "23rd dec 2026"],
  ])("%s → %s", (input, output) => {
    expect(formatTripDate(input)).toBe(output);
  });
});

describe("formatDisplayDate", () => {
  it("formats for screens and passes through invalid input", () => {
    expect(formatDisplayDate("19/01/2026")).toBe("19 Jan 2026");
    expect(formatDisplayDate("05/12/2026")).toBe("5 Dec 2026");
    expect(formatDisplayDate("nope")).toBe("nope");
  });
});

describe("todayIST", () => {
  it("rolls over at IST midnight, not UTC midnight", () => {
    expect(todayIST(new Date("2026-01-12T18:29:00Z"))).toBe("12/01/2026"); // 23:59 IST
    expect(todayIST(new Date("2026-01-12T18:30:00Z"))).toBe("13/01/2026"); // 00:00 IST
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("13/01/2026", 30)).toBe("12/02/2026");
    expect(addDays("05/01/2026", -14)).toBe("22/12/2025");
  });
});

describe("defaultDueDate", () => {
  it("is 14 days before the trip starts", () => {
    expect(defaultDueDate("19/03/2026", "13/01/2026")).toBe("05/03/2026");
  });

  it("never falls before the invoice date", () => {
    expect(defaultDueDate("19/01/2026", "13/01/2026")).toBe("13/01/2026");
  });

  it("falls back to the invoice date when the trip date is invalid", () => {
    expect(defaultDueDate("", "13/01/2026")).toBe("13/01/2026");
  });
});

describe("ISO conversion", () => {
  it("round-trips", () => {
    expect(toISODate("13/01/2026")).toBe("2026-01-13");
    expect(fromISODate("2026-01-13")).toBe("13/01/2026");
    expect(fromISODate("2026-02-31")).toBe("");
  });
});

describe("formatTimestampIST", () => {
  it("shows an ISO timestamp in India time", () => {
    expect(formatTimestampIST("2026-01-13T10:12:00.000Z")).toBe("13 Jan 2026, 3:42 pm");
    expect(formatTimestampIST("2026-01-12T18:30:00.000Z")).toBe("13 Jan 2026, 12:00 am");
  });

  it("is empty for a missing or invalid timestamp", () => {
    expect(formatTimestampIST("")).toBe("");
    expect(formatTimestampIST("not a date")).toBe("");
  });
});
