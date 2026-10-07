import { describe, expect, it } from "vitest";
import {
  factionLogCategoryForEvent,
  normalizeFactionEventType,
  sqlCategoryFilter,
} from "../src/lib/faction-logs";

describe("faction logs", () => {
  it("normalizes legacy audit actions", () => {
    expect(normalizeFactionEventType("invite_sent")).toBe("member_invited");
    expect(normalizeFactionEventType("rank_up")).toBe("member_promoted");
    expect(normalizeFactionEventType("member_joined")).toBe("member_joined");
  });

  it("maps events to UI categories", () => {
    expect(factionLogCategoryForEvent("fwarn")).toBe("warnings");
    expect(factionLogCategoryForEvent("setleader")).toBe("leadership");
    expect(factionLogCategoryForEvent("application_rejected")).toBe("applications");
  });

  it("includes legacy action names in SQL category filters", () => {
    const { params } = sqlCategoryFilter("ranks");
    expect(params).toContain("promote");
    expect(params).toContain("member_promoted");
  });
});
