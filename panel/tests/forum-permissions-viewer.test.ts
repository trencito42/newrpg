import { describe, expect, it } from "vitest";
import { getForumViewerContext } from "../src/lib/forum-permissions";
import type { UserSession } from "../src/lib/types";

function session(partial: Partial<UserSession> & { accountId: number }): UserSession {
  return {
    accountId: partial.accountId,
    username: partial.username ?? "test",
    adminLevel: partial.adminLevel ?? 0,
    helperLevel: partial.helperLevel ?? 0,
    selectedCharacterId: partial.selectedCharacterId ?? null,
    locale: partial.locale ?? "en",
  } as UserSession;
}

describe("getForumViewerContext", () => {
  it("marks admin and staff correctly", () => {
    const admin = getForumViewerContext(session({ accountId: 1, adminLevel: 2 }));
    expect(admin.isAdmin).toBe(true);
    expect(admin.isStaff).toBe(true);

    const helper = getForumViewerContext(session({ accountId: 2, helperLevel: 1 }));
    expect(helper.isAdmin).toBe(false);
    expect(helper.isStaff).toBe(true);
  });

  it("exposes selected character id", () => {
    const ctx = getForumViewerContext(
      session({ accountId: 3, selectedCharacterId: 99 })
    );
    expect(ctx.characterId).toBe(99);
  });
});
