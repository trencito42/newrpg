import "server-only";

import { cache } from "react";
import { dbQuery, dbQuerySingle } from "./db";
import { factionGradeSql, factionIdSql } from "./faction-sql";
import type { UserSession } from "./types";
import type { Forum, ForumPermissions } from "./forum-types";
import type { RowDataPacket } from "mysql2";
import { evaluateForumCapability, type ForumAccessRule, type ForumViewerContext } from "./forum-acl";
export type { ForumCapability, ForumAccessRule, ForumViewerContext } from "./forum-acl";

interface ViewerRow extends RowDataPacket {
  character_id: number;
  faction_id: string | null;
  faction_rank: number;
  clan_id: number | null;
  clan_rank: "member" | "officer" | "leader" | null;
}

const CLAN_RANK: Record<string, number> = { member: 0, officer: 1, leader: 2 };

const loadViewer = cache(async (
  accountId: number,
  characterId: number | null,
  adminLevel: number,
  helperLevel: number
): Promise<ForumViewerContext> => {
  const base: ForumViewerContext = {
    accountId,
    characterId,
    adminLevel,
    helperLevel,
    factionId: null,
    factionRank: 0,
    clanId: null,
    clanRank: 0,
  };
  if (!characterId) return base;

  const row = await dbQuerySingle<ViewerRow>(
    `SELECT c.id AS character_id,
            fm.faction_id AS faction_id,
            CASE WHEN fm.character_id IS NULL THEN 0 ELSE ${factionGradeSql()} END AS faction_rank,
            cm.clan_id,
            cm.rank AS clan_rank
     FROM characters c
     JOIN players p ON p.id = c.player_id AND p.account_id = ?
     LEFT JOIN faction_membership fm ON fm.character_id = c.id
       AND fm.faction_id COLLATE utf8mb4_unicode_ci = ${factionIdSql()}
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     WHERE c.id = ?
     LIMIT 1`,
    [accountId, characterId]
  );
  if (!row) return { ...base, characterId: null };
  return {
    ...base,
    characterId: Number(row.character_id),
    factionId: row.faction_id?.toLowerCase() || null,
    factionRank: Number(row.faction_rank) || 0,
    clanId: row.clan_id ? Number(row.clan_id) : null,
    clanRank: row.clan_rank ? CLAN_RANK[row.clan_rank] ?? 0 : 0,
  };
});

export async function getForumViewerContext(session: UserSession | null): Promise<ForumViewerContext> {
  if (!session) {
    return { accountId: null, characterId: null, adminLevel: 0, helperLevel: 0, factionId: null, factionRank: 0, clanId: null, clanRank: 0 };
  }
  return loadViewer(session.accountId, session.selectedCharacterId, session.adminLevel, session.helperLevel);
}

async function loadRules(forums: Forum[]): Promise<ForumAccessRule[]> {
  if (!forums.length) return [];
  const forumIds = [...new Set(forums.map((forum) => forum.id))];
  const categoryIds = [...new Set(forums.filter((forum) => forum.inherit_category_permissions !== false).map((forum) => forum.category_id))];
  const clauses: string[] = [];
  const params: number[] = [];
  if (forumIds.length) {
    clauses.push(`(scope_type = 'forum' AND scope_id IN (${forumIds.map(() => "?").join(",")}))`);
    params.push(...forumIds);
  }
  if (categoryIds.length) {
    clauses.push(`(scope_type = 'category' AND scope_id IN (${categoryIds.map(() => "?").join(",")}))`);
    params.push(...categoryIds);
  }
  try {
    return await dbQuery<ForumAccessRule>(`SELECT * FROM panel_forum_access_rules WHERE ${clauses.join(" OR ")}`, params);
  } catch (error) {
    // Rolling deploys can briefly run application code before the additive ACL
    // migration. The legacy access columns remain secure during that window.
    if ((error as { code?: string }).code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

function rulesForForum(forum: Forum, rules: ForumAccessRule[]): ForumAccessRule[] {
  return rules.filter((rule) =>
    (rule.scope_type === "forum" && rule.scope_id === forum.id) ||
    (forum.inherit_category_permissions !== false && rule.scope_type === "category" && rule.scope_id === forum.category_id)
  );
}

export async function getForumAccessMap(
  session: UserSession | null,
  forums: Forum[]
): Promise<Map<number, ForumPermissions>> {
  const [viewer, rules] = await Promise.all([getForumViewerContext(session), loadRules(forums)]);
  const result = new Map<number, ForumPermissions>();
  for (const forum of forums) {
    const scoped = rulesForForum(forum, rules);
    const canView = evaluateForumCapability(forum, viewer, scoped, "view");
    const canModerate = canView && evaluateForumCapability(forum, viewer, scoped, "moderate");
    result.set(forum.id, {
      canView,
      canCreateTopic: canView && evaluateForumCapability(forum, viewer, scoped, "create_topic"),
      canReply: canView && evaluateForumCapability(forum, viewer, scoped, "reply"),
      canEditOwn: canView && evaluateForumCapability(forum, viewer, scoped, "edit_own"),
      canDeleteOwn: canView && evaluateForumCapability(forum, viewer, scoped, "delete_own"),
      canModerate,
      canModDeletePost: canModerate,
      canModLockTopic: canModerate,
      canModPinTopic: canModerate,
      canModMoveTopic: canModerate,
      canModRestorePost: canModerate,
      canAdminManageForum: evaluateForumCapability(forum, viewer, scoped, "manage"),
      canAdminManageCategory: evaluateForumCapability(forum, viewer, scoped, "manage"),
    });
  }
  return result;
}

export async function getForumPermissions(session: UserSession | null, forum: Forum): Promise<ForumPermissions> {
  const map = await getForumAccessMap(session, [forum]);
  return map.get(forum.id)!;
}

export async function canAccessForum(session: UserSession | null, forum: Forum): Promise<boolean> {
  return (await getForumPermissions(session, forum)).canView;
}

export async function canCreateTopic(session: UserSession | null, forum: Forum): Promise<boolean> {
  return (await getForumPermissions(session, forum)).canCreateTopic;
}

export async function canReplyToTopic(session: UserSession | null, forum: Forum, topicLocked: boolean): Promise<boolean> {
  return !topicLocked && (await getForumPermissions(session, forum)).canReply;
}

export async function canModerateForum(session: UserSession | null, forum: Forum): Promise<boolean> {
  return (await getForumPermissions(session, forum)).canModerate;
}
