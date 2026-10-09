import { dbQuerySingle } from "./db";
import { RowDataPacket } from "mysql2";

/** Same account key as update-likers-query (one panel account + one in-game character = one person). */
export const REACTION_ACCOUNT_KEY_SQL = `COALESCE(pl.account_id, r.reactor_id)`;

const REACTION_JOIN = `
  LEFT JOIN characters c ON r.reactor_type = 'character' AND c.id = r.reactor_id
  LEFT JOIN players pl ON pl.id = c.player_id`;

export function updateReactionCountSubquery(
  updateIdRef: string,
  reaction: "like" | "dislike"
): string {
  return `(
    SELECT COUNT(DISTINCT ${REACTION_ACCOUNT_KEY_SQL})
    FROM panel_update_reactions r
    ${REACTION_JOIN}
    WHERE r.update_id = ${updateIdRef} AND r.reaction = '${reaction}'
  )`;
}

function updateReactionCountSubqueryBound(reaction: "like" | "dislike"): string {
  return `(
    SELECT COUNT(DISTINCT ${REACTION_ACCOUNT_KEY_SQL})
    FROM panel_update_reactions r
    ${REACTION_JOIN}
    WHERE r.update_id = ? AND r.reaction = '${reaction}'
  )`;
}

export function updateMyReactionSubquery(updateIdRef: string, accountIdParam = "?"): string {
  return `(
    SELECT r.reaction
    FROM panel_update_reactions r
    LEFT JOIN characters cv ON r.reactor_type = 'character' AND cv.id = r.reactor_id
    LEFT JOIN players pv ON pv.id = cv.player_id
    WHERE r.update_id = ${updateIdRef}
      AND (
        (r.reactor_type = 'account' AND r.reactor_id = ${accountIdParam})
        OR (pv.account_id = ${accountIdParam})
      )
    ORDER BY CASE WHEN r.reactor_type = 'character' THEN 0 ELSE 1 END, r.created_at DESC
    LIMIT 1
  )`;
}

interface CountRow extends RowDataPacket {
  likes_count: number;
  dislikes_count: number;
}

export async function fetchUpdateReactionCounts(updateId: number): Promise<{
  likes_count: number;
  dislikes_count: number;
}> {
  const row = await dbQuerySingle<CountRow>(
    `SELECT
       ${updateReactionCountSubqueryBound("like")} AS likes_count,
       ${updateReactionCountSubqueryBound("dislike")} AS dislikes_count`,
    [updateId, updateId]
  );
  return {
    likes_count: Number(row?.likes_count ?? 0),
    dislikes_count: Number(row?.dislikes_count ?? 0),
  };
}
