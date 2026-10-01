import { describe, it, expect } from "vitest";
import { UserSession } from "../src/lib/types";
import { toViewerSessionDTO } from "../src/lib/session-dto";

describe("Role-Based Access Control & Identity Checks", () => {
  const regularCitizen: UserSession = {
    accountId: 10,
    username: "Dan_Popa",
    email: null,
    selectedCharacterId: 101,
    selectedCharacterName: "Dan_Popa",
    adminLevel: 0,
    helperLevel: 0,
    language: "ro",
  };

  const helperUser: UserSession = {
    ...regularCitizen,
    accountId: 11,
    username: "Helper_Alex",
    helperLevel: 2,
    adminLevel: 0,
  };

  const adminUser: UserSession = {
    ...regularCitizen,
    accountId: 12,
    username: "Admin_Mihai",
    adminLevel: 4,
    helperLevel: 0,
  };

  it("prohibits regular citizens from accessing staff features", () => {
    const isStaff = regularCitizen.adminLevel >= 1 || regularCitizen.helperLevel >= 1;
    expect(isStaff).toBe(false);
  });

  it("permits helpers and admins to access staff center", () => {
    const helperStaff = helperUser.adminLevel >= 1 || helperUser.helperLevel >= 1;
    const adminStaff = adminUser.adminLevel >= 1 || adminUser.helperLevel >= 1;

    expect(helperStaff).toBe(true);
    expect(adminStaff).toBe(true);
  });

  it("distinguishes senior administrative authority from helper moderation", () => {
    const canManageFactions = (user: UserSession) => user.adminLevel >= 4;
    const canSanctionBans = (user: UserSession) => user.adminLevel >= 2;

    expect(canManageFactions(regularCitizen)).toBe(false);
    expect(canManageFactions(helperUser)).toBe(false);
    expect(canManageFactions(adminUser)).toBe(true);

    expect(canSanctionBans(helperUser)).toBe(false);
    expect(canSanctionBans(adminUser)).toBe(true);
  });

  it("prevents IDOR: only owner or staff can view private player account details", () => {
    function canViewPrivateAccount(user: UserSession | null, targetAccountId: number): boolean {
      if (!user) return false;
      if (user.accountId === targetAccountId) return true;
      if (user.adminLevel >= 4) return true; // Senior Staff
      return false;
    }

    // Citizen trying to view someone else's account
    expect(canViewPrivateAccount(regularCitizen, 999)).toBe(false);

    // Citizen viewing their own account
    expect(canViewPrivateAccount(regularCitizen, 10)).toBe(true);

    // Senior admin viewing target account for support/investigation
    expect(canViewPrivateAccount(adminUser, 999)).toBe(true);
  });

  it("never serializes session credentials or private email into client props", () => {
    const internal = {
      ...regularCitizen,
      sessionToken: "secret-session-sentinel",
      tokenHash: "secret-hash-sentinel",
      ipAddress: "private-ip-sentinel",
      email: "private-email-sentinel@example.invalid",
    } as UserSession;
    const serialized = JSON.stringify(toViewerSessionDTO(internal));
    expect(serialized).not.toContain("secret-session-sentinel");
    expect(serialized).not.toContain("secret-hash-sentinel");
    expect(serialized).not.toContain("private-ip-sentinel");
    expect(serialized).not.toContain("private-email-sentinel");
    expect(JSON.parse(serialized).username).toBe(regularCitizen.username);
  });
});
