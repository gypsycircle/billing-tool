import { describe, expect, it } from "vitest";
import { restoreHint, showArchivedLabel } from "./records";

describe("finding an archived record again", () => {
  it("names the tick box in that list's Filters", () => {
    expect(showArchivedLabel("bookings")).toBe("Show archived bookings only");
  });

  it("says it for things and them for people", () => {
    expect(restoreHint("bookings")).toBe("To restore it, open Filters and tick Show archived bookings only.");
    expect(restoreHint("team members")).toBe("To restore them, open Filters and tick Show archived team members only.");
  });
});
