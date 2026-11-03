import { describe, expect, it } from "vitest";
import { firstValues } from "./route";

describe("firstValues", () => {
  it("keeps each parameter's first value, as pages do", () => {
    expect(firstValues(new URLSearchParams("type=salary&type=wages&page=2"))).toEqual({ type: "salary", page: "2" });
  });

  it("keeps names like __proto__ as plain keys", () => {
    const query = firstValues(new URLSearchParams("__proto__=x&constructor=y"));
    expect(Object.keys(query)).toEqual(["__proto__", "constructor"]);
    expect(Object.getPrototypeOf(query)).toBe(Object.prototype);
  });
});
