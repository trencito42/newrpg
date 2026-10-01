import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSameOriginWrite } from "../src/lib/request-security";

describe("state-changing request origin policy", () => {
  const url = "https://rpg.example/api/polls/vote";

  it("accepts same-origin browser writes", () => {
    const req = new NextRequest(url, { method: "POST", headers: { origin: "https://rpg.example", "sec-fetch-site": "same-origin" } });
    expect(isSameOriginWrite(req)).toBe(true);
  });

  it("rejects cross-site form submissions", () => {
    const req = new NextRequest(url, { method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" } });
    expect(isSameOriginWrite(req)).toBe(false);
  });

  it("rejects writes without browser origin evidence", () => {
    const req = new NextRequest(url, { method: "POST" });
    expect(isSameOriginWrite(req)).toBe(false);
  });
});
