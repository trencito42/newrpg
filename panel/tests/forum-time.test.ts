import { describe, expect, it } from "vitest";
import { formatForumClock, formatForumDaySeparator, toEpochSeconds } from "../src/lib/forum-time";

describe("forum-time", () => {
  it("normalizes unix seconds and milliseconds", () => {
    expect(toEpochSeconds(1_700_000_000)).toBe(1_700_000_000);
    expect(toEpochSeconds(1_700_000_000_000)).toBe(1_700_000_000);
  });

  it("formats clock from ISO string", () => {
    const iso = "2026-01-15T14:30:00.000Z";
    const sec = toEpochSeconds(iso);
    expect(sec).not.toBeNull();
    expect(formatForumClock(sec!, "en")).toMatch(/\d{2}:\d{2}/);
  });

  it("returns today separator for current day", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(formatForumDaySeparator(nowSec, "en")).toBe("Today");
  });
});
