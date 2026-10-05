// ============================================================
// forum-permissions.ts — Permission system for the forum
// ============================================================

import { dbQuerySingle } from "./db";
import type { UserSession } from "./types";
import type { Forum, ForumPermissions } from "./forum-types";
import type { RowDataPacket } from "mysql2";

interface CountRow extends RowDataPacket {
  cnt: number;
}

export interface ForumViewerContext {
  session: UserSession | null;
  accountId: number;
  characterId: number | null;
  isStaff: boolean;
  isAdmin: boolean;
}

export function getForumViewerContext(session: UserSession | null): ForumViewerContext {
  const isAdmin = session !== null && session.adminLevel >= 1;
  const isStaff = isAdmin || (session?.helperLevel ?? 0) >= 1;
  return {
    session,
    accountId: session?.accountId ?? 0,
    characterId: session?.selectedCharacterId ?? null,
    isStaff,
    isAdmin,
  };
}

async function characterInFaction(characterId: number, factionId: string): Promise<boolean> {
  const row = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS cnt
     FROM faction_membership fm
     WHERE fm.character_id = ? AND fm.faction_id = ?
     LIMIT 1`,
    [characterId, factionId]
  );
  return (row?.cnt ?? 0) > 0;
}

async function characterInClan(characterId: number, clanId: number): Promise<boolean> {
  const row = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS cnt
     FROM clan_members cm
     INNER JOIN clans c ON c.id = cm.clan_id
     WHERE cm.character_id = ? AND cm.clan_id = ? AND c.status <> 'expired'
     LIMIT 1`,
    [characterId, clanId]
  );
  return (row?.cnt ?? 0) > 0;
}

async function accountHasCharacterInFaction(accountId: number, factionId: string): Promise<boolean> {
  const row = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS cnt
     FROM faction_membership fm
     JOIN characters c ON c.id = fm.character_id
     JOIN players p ON p.id = c.player_id
     WHERE p.account_id = ? AND fm.faction_id = ?
     LIMIT 1`,
    [accountId, factionId]
  );
  return (row?.cnt ?? 0) > 0;
}

async function accountHasCharacterInClan(accountId: number, clanId: number): Promise<boolean> {
  const row = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS cnt
     FROM clan_members cm
     JOIN characters c ON c.id = cm.character_id
     JOIN players p ON p.id = c.player_id
     JOIN clans cl ON cl.id = cm.clan_id
     WHERE p.account_id = ? AND cm.clan_id = ? AND cl.status <> 'expired'
     LIMIT 1`,
    [accountId, clanId]
  );
  return (row?.cnt ?? 0) > 0;
}

/**
 * Determine whether the session can view the given forum.
 */
export async function canAccessForum(
  session: UserSession | null,
  forum: Forum
): Promise<boolean> {
  const viewer = getForumViewerContext(session);

  if (!forum.is_visible) {
    return viewer.isStaff;
  }

  switch (forum.access_type) {
    case "public":
      return true;

    case "registered":
      return viewer.session !== null;

    case "staff":
      return viewer.isStaff;

    case "faction": {
      if (!viewer.session) return false;
      if (viewer.isStaff) return true;
      const target = (forum.access_target || "").trim();
      if (!target) return false;
      if (viewer.characterId) {
        return characterInFaction(viewer.characterId, target);
      }
      return accountHasCharacterInFaction(viewer.accountId, target);
    }

    case "clan": {
      if (!viewer.session) return false;
      if (viewer.isStaff) return true;
      const clanId = parseInt(forum.access_target || "", 10);
      if (!Number.isFinite(clanId) || clanId <= 0) return false;
      if (viewer.characterId) {
        return characterInClan(viewer.characterId, clanId);
      }
      return accountHasCharacterInClan(viewer.accountId, clanId);
    }

    case "custom":
      return viewer.isStaff;

    default:
      return false;
  }
}

export const canViewForum = canAccessForum;

/**
 * Compute all permissions for the current session on the given forum.
 */
export async function getForumPermissions(
  session: UserSession | null,
  forum: Forum
): Promise<ForumPermissions> {
  const viewer = getForumViewerContext(session);
  const canView = await canAccessForum(session, forum);

  const canCreateTopic = canView && viewer.session !== null && !forum.is_locked;
  const canReply = canCreateTopic;

  const canEditOwn = canView && viewer.session !== null;
  const canDeleteOwn = canEditOwn;

  return {
    canView,
    canCreateTopic,
    canReply,
    canEditOwn,
    canDeleteOwn,
    canModerate: viewer.isStaff,
    canModDeletePost: viewer.isStaff,
    canModLockTopic: viewer.isStaff,
    canModPinTopic: viewer.isStaff,
    canModMoveTopic: viewer.isStaff,
    canModRestorePost: viewer.isStaff,
    canAdminManageForum: viewer.isAdmin,
    canAdminManageCategory: viewer.isAdmin,
  };
}
