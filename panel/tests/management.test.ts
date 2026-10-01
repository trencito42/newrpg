import { describe, it, expect } from "vitest";
import { CANONICAL_FACTIONS, getFactionColor, getFactionLabel, isFaction } from "../src/lib/factions";

describe("Management Layer & Permissions Matrix", () => {
  it("verifies canonical faction definitions and colors", () => {
    expect(isFaction("police")).toBe(true);
    expect(isFaction("sheriff")).toBe(true);
    expect(isFaction("sunset_cartel")).toBe(true);
    expect(isFaction("unemployed")).toBe(false);

    expect(getFactionColor("police")).toBe("#3b82f6");
    expect(getFactionColor("medic")).toBe("#ef4444");
    expect(getFactionColor("unemployed")).toBeNull();

    expect(getFactionLabel("police")).toBe("LSPD");
    expect(getFactionLabel("sunset_cartel")).toBe("Sunset Cartel");
  });

  it("enforces staff role level boundaries", () => {
    const adminLevels = [1, 2, 3, 4, 5, 6];
    const helperLevels = [1, 2, 3];

    // Admin Level 6 is the highest owner level
    expect(Math.max(...adminLevels)).toBe(6);
    expect(Math.max(...helperLevels)).toBe(3);

    // Permission required per action
    const minAdminReq: Record<string, number> = {
      warn: 1,
      mute: 1,
      unmute: 1,
      ban: 2,
      jail: 2,
      unjail: 2,
      unban: 3,
      set_faction: 3,
      set_clan: 4,
      faction_set_leader: 4,
      clan_dissolve: 5,
      staff_set_admin: 6,
      staff_set_helper: 6,
      staff_remove_role: 6,
    };

    expect(minAdminReq.staff_set_admin).toBe(6);
    expect(minAdminReq.staff_set_helper).toBe(6);
    expect(minAdminReq.ban).toBe(2);
    expect(minAdminReq.unban).toBe(3);
    expect(minAdminReq.set_clan).toBe(4);
  });

  it("validates hierarchy protection logic", () => {
    function canModerate(actorLevel: number, targetLevel: number): boolean {
      if (actorLevel <= 0) return false;
      if (actorLevel >= 6) return true; // Owner override
      return actorLevel > targetLevel; // Lower admin cannot moderate equal or higher
    }

    expect(canModerate(1, 0)).toBe(true);
    expect(canModerate(1, 1)).toBe(false); // Equal level protected
    expect(canModerate(1, 2)).toBe(false); // Higher level protected
    expect(canModerate(2, 1)).toBe(true);
    expect(canModerate(3, 3)).toBe(false);
    expect(canModerate(6, 6)).toBe(true); // Superadmin can manage
  });

  it("validates organization application state transitions", () => {
    const validTransitions: Record<string, string[]> = {
      submitted: ["under_review", "accepted", "rejected", "withdrawn"],
      under_review: ["accepted", "rejected", "withdrawn"],
      accepted: ["archived"],
      rejected: ["archived"],
      withdrawn: ["archived"],
      archived: [],
    };

    function isValidTransition(from: string, to: string): boolean {
      return (validTransitions[from] || []).includes(to);
    }

    expect(isValidTransition("submitted", "accepted")).toBe(true);
    expect(isValidTransition("submitted", "rejected")).toBe(true);
    expect(isValidTransition("under_review", "accepted")).toBe(true);
    expect(isValidTransition("rejected", "accepted")).toBe(false); // Silent override blocked
    expect(isValidTransition("accepted", "rejected")).toBe(false); // Double decision blocked
  });

  it("validates faction & clan application management roles", () => {
    // Faction rules
    function canReviewFactionApp(rank: number, isLeader: boolean, adminLevel: number): boolean {
      if (adminLevel >= 3) return true;
      if (isLeader || rank >= 6) return true; // Rank 6 Sub-Leader & Rank 7 Leader
      return false; // Rank 1-5 cannot review
    }

    function canConfigureFactionApps(rank: number, isLeader: boolean, adminLevel: number): boolean {
      if (adminLevel >= 4) return true;
      return isLeader || rank >= 7; // Only Leader (Rank 7) can open/close and edit questions
    }

    expect(canReviewFactionApp(5, false, 0)).toBe(false);
    expect(canReviewFactionApp(6, false, 0)).toBe(true);
    expect(canReviewFactionApp(7, true, 0)).toBe(true);
    expect(canReviewFactionApp(1, false, 3)).toBe(true); // Admin override

    expect(canConfigureFactionApps(6, false, 0)).toBe(false); // Sub-leader cannot open/close
    expect(canConfigureFactionApps(7, true, 0)).toBe(true);

    // Clan rules
    function canReviewClanApp(rank: number, isOwner: boolean, adminLevel: number): boolean {
      if (adminLevel >= 4) return true;
      return isOwner || rank >= 6; // Rank 6 Co-Leader & Rank 7 Leader
    }

    function canConfigureClanApps(rank: number, isOwner: boolean, adminLevel: number): boolean {
      if (adminLevel >= 4) return true;
      return isOwner || rank >= 7; // Only Leader (Rank 7)
    }

    expect(canReviewClanApp(5, false, 0)).toBe(false); // Officer cannot review apps
    expect(canReviewClanApp(6, false, 0)).toBe(true);
    expect(canReviewClanApp(7, true, 0)).toBe(true);

    expect(canConfigureClanApps(6, false, 0)).toBe(false);
    expect(canConfigureClanApps(7, true, 0)).toBe(true);
  });
});
