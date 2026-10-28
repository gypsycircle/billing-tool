import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ APP_URL: "https://billing.example.com" as string | undefined }));
vi.mock("../env", () => ({ getEnv: () => env }));

import { assertSameOrigin } from "./origin";

function post(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("allows the configured origin", () => {
    const res = assertSameOrigin(
      post("https://billing.example.com/api/x", {
        origin: "https://billing.example.com",
        "sec-fetch-site": "same-origin",
      })
    );
    expect(res).toBeNull();
  });

  it.each<[Record<string, string>, string]>([
    [{}, "missing Origin"],
    [{ origin: "https://evil.example.com" }, "other origin"],
    [{ origin: "not a url" }, "malformed Origin"],
    [{ origin: "http://billing.example.com" }, "wrong scheme"],
    [{ origin: "https://billing.example.com", "sec-fetch-site": "cross-site" }, "cross-site fetch"],
    [{ origin: "https://billing.example.com", "sec-fetch-site": "same-site" }, "same-site (subdomain)"],
  ])("rejects %o (%s)", (headers) => {
    expect(assertSameOrigin(post("https://billing.example.com/api/x", headers))?.status).toBe(403);
  });

  it("ignores a forged x-forwarded-host", () => {
    const res = assertSameOrigin(
      post("https://billing.example.com/api/x", {
        origin: "https://evil.example.com",
        "x-forwarded-host": "evil.example.com",
      })
    );
    expect(res?.status).toBe(403);
  });

  it("falls back to the request origin when APP_URL is unset (development)", () => {
    env.APP_URL = undefined;
    expect(
      assertSameOrigin(post("http://localhost:3000/api/x", { origin: "http://localhost:3000" }))
    ).toBeNull();
    env.APP_URL = "https://billing.example.com";
  });
});
