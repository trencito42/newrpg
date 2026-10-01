import { describe, it, expect } from "vitest";
import { z } from "zod";

const voteSchema = z.object({
  pollId: z.number().int().positive(),
  optionId: z.number().int().positive(),
});

describe("Community Poll Voting Invariants", () => {
  it("validates valid vote submission schema", () => {
    const valid = { pollId: 1, optionId: 2 };
    const res = voteSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects invalid payload inputs", () => {
    expect(voteSchema.safeParse({ pollId: -1, optionId: 2 }).success).toBe(false);
    expect(voteSchema.safeParse({ pollId: "abc", optionId: 2 }).success).toBe(false);
    expect(voteSchema.safeParse({}).success).toBe(false);
  });

  it("enforces poll status and time boundary checks", () => {
    function isPollOpenForVoting(
      status: string,
      startsAt: Date,
      endsAt: Date,
      now = new Date()
    ): boolean {
      if (status !== "active") return false;
      if (now < startsAt) return false;
      if (now > endsAt) return false;
      return true;
    }

    const now = new Date("2026-10-01T12:00:00Z");
    const activeStart = new Date("2026-10-01T00:00:00Z");
    const activeEnd = new Date("2026-10-31T23:59:59Z");
    const expiredEnd = new Date("2026-09-30T23:59:59Z");

    // Active within window
    expect(isPollOpenForVoting("active", activeStart, activeEnd, now)).toBe(true);

    // Closed status
    expect(isPollOpenForVoting("closed", activeStart, activeEnd, now)).toBe(false);

    // Past expiration date
    expect(isPollOpenForVoting("active", activeStart, expiredEnd, now)).toBe(false);
  });

  it("enforces minimum eligibility requirements (level & hours played)", () => {
    function isEligibleToVote(
      playerLevel: number,
      minLevel: number,
      hoursPlayed: number,
      minHours: number
    ): boolean {
      return playerLevel >= minLevel && hoursPlayed >= minHours;
    }

    // Newbie: level 1, 2 hours -> ineligible when min level is 3
    expect(isEligibleToVote(1, 3, 2, 10)).toBe(false);

    // Experienced citizen: level 5, 25 hours -> eligible
    expect(isEligibleToVote(5, 3, 25, 10)).toBe(true);
  });
});
