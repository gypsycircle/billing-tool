import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/bookings/new", "/bookings/new"],
    ["/bookings/abc?tab=pdf#top", "/bookings/abc?tab=pdf#top"],
    ["/bookings/../", "/bookings"],
    ["/bookings?q=a%20b", "/bookings?q=a%20b"],
  ])("keeps same-origin path %s", (input, output) => {
    expect(safeRedirectPath(input)).toBe(output);
  });

  it.each([
    undefined,
    null,
    "",
    "bookings",
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/foo\nbar",
    "/%5Cevil.com",
    "/%2F%2Fevil.com",
    "/%0d%0aSet-Cookie:x",
    "/%E0%A4%A",
    "/.//evil.com",
    "/%2e//evil.com",
    "/a/..//evil.com",
    "/access",
    "/access?next=/",
    "/",
    "/?next=/bookings",
    "/" + "a".repeat(600),
  ])("rejects %s", (input) => {
    expect(safeRedirectPath(input)).toBe("/bookings");
  });
});
