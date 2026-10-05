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

/**
 * Check whether the account has a character in the given faction.
 */
async function hasFactionAccess(accountId: number, factionId: string): Promise<boolean> {
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

/**
 * Check whether the account has any character that is a clan member.
 */
async function hasClanAccess(accountId: number): Promise<boolean> {
  const row = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS cnt
     FROM clan_members cm
     JOIN characters c ON c.id = cm.character_id
     JOIN players p ON p.id = c.player_id
     WHERE p.account_id = ?
     LIMIT 1`,
    [accountId]
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
  if (!forum.is_visible) {
    // Hidden forums are only accessible to staff
    return (session?.adminLevel ?? 0) >= 1 || (session?.helperLevel ?? 0) >= 1;
  }

  switch (forum.access_type) {
    case "public":
      return true;

    case "registered":
      return session !== null;

    case "staff":
      if (!session) return false;
      return session.adminLevel >= 1 || session.helperLevel >= 1;

    case "faction":
      if (!session) return false;
      // Staff bypass faction restriction
      if (session.adminLevel >= 1 || session.helperLevel >= 1) return true;
      if (!forum.access_target) return false;
      return hasFactionAccess(session.accountId, forum.access_target);

    case "clan":
      if (!session) return false;
      if (session.adminLevel >= 1 || session.helperLevel >= 1) return true;
      return hasClanAccess(session.accountId);

    case "custom":
      if (!session) return false;
      return session.adminLevel >= 1 || session.helperLevel >= 1;

    default:
      return false;
  }
}

/**
 * Compute all permissions for the current session on the given forum.
 * Does NOT check topic-level lock status — callers must do that additionally.
 */
export async function getForumPermissions(
  session: UserSession | null,
  forum: Forum
): Promise<ForumPermissions> {
  const isModerator = session !== null && (session.adminLevel >= 1 || session.helperLevel >= 1);
  const isAdmin = session !== null && session.adminLevel >= 1;
  const canView = await canAccessForum(session, forum);

  const canCreateTopic =
    canView &&
    session !== null &&
    !forum.is_locked;

  const canReply = canCreateTopic; // topic-level lock checked separately

  const canEditOwn = canView && session !== null;
  const canDeleteOwn = canEditOwn;

  return {
    canView,
    canCreateTopic,
    canReply,
    canEditOwn,
    canDeleteOwn,
    canModerate: isModerator,
    canModDeletePost: isModerator,
    canModLockTopic: isModerator,
    canModPinTopic: isModerator,
    canModMoveTopic: isModerator,
    canModRestorePost: isModerator,
    canAdminManageForum: isAdmin,
    canAdminManageCategory: isAdmin,
  };
}
