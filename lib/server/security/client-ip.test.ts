import { describe, expect, it } from "vitest";
import { getClientIp, rateLimitClientKey } from "./client-ip";

const req = (headers: Record<string, string>) => new Request("https://x.test/", { headers });

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for, then x-real-ip", () => {
    expect(getClientIp(req({ "x-vercel-forwarded-for": "1.1.1.1, 2.2.2.2", "x-real-ip": "3.3.3.3" }))).toBe("1.1.1.1");
    expect(getClientIp(req({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("never trusts client-supplied x-forwarded-for", () => {
    expect(getClientIp(req({ "x-forwarded-for": "6.6.6.6" }))).toBe("unknown");
  });
});

describe("rateLimitClientKey", () => {
  it("keeps IPv4 as is", () => {
    expect(rateLimitClientKey("203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitClientKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("groups IPv6 by /64", () => {
    const a = rateLimitClientKey("2001:db8:abcd:12:1::1");
    const b = rateLimitClientKey("2001:0DB8:ABCD:0012:ffff:ffff:ffff:ffff");
    expect(a).toBe("2001:0db8:abcd:0012::/64");
    expect(b).toBe(a);
    expect(rateLimitClientKey("2001:db8:abcd:13::1")).not.toBe(a);
  });

  it("handles compressed forms and leaves junk untouched", () => {
    expect(rateLimitClientKey("::1")).toBe("0000:0000:0000:0000::/64");
    expect(rateLimitClientKey("fe80::")).toBe("fe80:0000:0000:0000::/64");
    expect(rateLimitClientKey("unknown")).toBe("unknown");
    expect(rateLimitClientKey("1::2::3")).toBe("1::2::3");
  });
});
