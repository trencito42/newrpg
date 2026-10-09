import { dbQuery, dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export interface FeedPost {
  id: number;
  character_id: number;
  firstname: string;
  lastname: string;
  faction_id: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  clan_tag_style: string | null;
  author_skin: string | null;
  body: string | null;
  media_id: number | null;
  media_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_viewer: number;
}

interface PostRow extends RowDataPacket, FeedPost {}

const FEED_SELECT = `
  SELECT p.id, p.character_id, c.firstname, c.lastname,
         JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction')) AS faction_id,
         JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.skin'))    AS author_skin,
         cl.tag       AS clan_tag,
         cl.tag_color AS clan_color,
         cl.tag_style AS clan_tag_style,
         p.body, p.media_id,
         pm.url AS media_url, pm.thumbnail_url, pm.width, pm.height,
         p.created_at, p.updated_at,
         COALESCE(lk.likes_count, 0)    AS likes_count,
         COALESCE(cmt.comments_count, 0) AS comments_count,
         CASE WHEN vl.post_id IS NOT NULL THEN 1 ELSE 0 END AS liked_by_viewer
  FROM social_posts p
  JOIN characters c ON c.id = p.character_id
  LEFT JOIN phone_media pm ON pm.id = p.media_id AND pm.deleted_at IS NULL
  LEFT JOIN clan_members clanm ON clanm.character_id = c.id
  LEFT JOIN clans cl ON cl.id = clanm.clan_id
  LEFT JOIN (SELECT post_id, COUNT(*) AS likes_count FROM social_post_likes GROUP BY post_id) lk ON lk.post_id = p.id
  LEFT JOIN (SELECT post_id, COUNT(*) AS comments_count FROM social_comments WHERE deleted_at IS NULL GROUP BY post_id) cmt ON cmt.post_id = p.id
  LEFT JOIN social_post_likes vl ON vl.post_id = p.id AND vl.character_id = ?
`;

export async function fetchSocialFeedPosts(opts: {
  characterIds?: number[] | null;
  beforeId?: number | null;
  limit: number;
  viewerCharId?: number | null;
}): Promise<FeedPost[]> {
  const { characterIds, beforeId, limit, viewerCharId } = opts;
  const params: (number | string)[] = [viewerCharId ?? 0];
  const whereClauses = ["p.deleted_at IS NULL"];

  if (characterIds && characterIds.length > 0) {
    whereClauses.push(`p.character_id IN (${characterIds.map(() => "?").join(",")})`);
    params.push(...characterIds);
  }

  if (beforeId) {
    whereClauses.push("p.id < ?");
    params.push(beforeId);
  }

  params.push(limit);

  return dbQuery<PostRow>(
    `${FEED_SELECT} WHERE ${whereClauses.join(" AND ")} ORDER BY p.id DESC LIMIT ?`,
    params
  );
}

export async function fetchSocialPostsForCharacter(
  characterId: number,
  limit: number,
  viewerCharId?: number | null
): Promise<FeedPost[]> {
  return fetchSocialFeedPosts({
    characterIds: [characterId],
    limit,
    viewerCharId,
  });
}

export interface FeedComment {
  id: number;
  post_id: number;
  character_id: number;
  firstname: string;
  lastname: string;
  faction_id: string | null;
  author_skin: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  clan_tag_style: string | null;
  parent_comment_id: number | null;
  body: string;
  created_at: string;
  updated_at: string | null;
}

interface CommentRow extends RowDataPacket, FeedComment {}

const COMMENT_SELECT = `
  SELECT c.id, c.post_id, c.character_id, ch.firstname, ch.lastname,
         JSON_UNQUOTE(JSON_EXTRACT(ch.metadata, '$.faction')) AS faction_id,
         JSON_UNQUOTE(JSON_EXTRACT(ch.metadata, '$.skin')) AS author_skin,
         cl.tag AS clan_tag, cl.tag_color AS clan_color, cl.tag_style AS clan_tag_style,
         c.parent_comment_id, c.body, c.created_at, c.updated_at
  FROM social_comments c
  JOIN characters ch ON ch.id = c.character_id
  LEFT JOIN clan_members clanm ON clanm.character_id = ch.id
  LEFT JOIN clans cl ON cl.id = clanm.clan_id
`;

export async function fetchSocialComments(
  postId: number,
  beforeId?: number | null,
  limit = 30
): Promise<FeedComment[]> {
  const params: number[] = [postId];
  let extra = "";
  if (beforeId) {
    extra = " AND c.id < ?";
    params.push(beforeId);
  }
  params.push(Math.min(limit, 100));
  return dbQuery<CommentRow>(
    `${COMMENT_SELECT} WHERE c.post_id = ? AND c.deleted_at IS NULL${extra} ORDER BY c.id ASC LIMIT ?`,
    params
  );
}

export async function countSocialPostsForCharacter(characterId: number): Promise<number> {
  interface C extends RowDataPacket { cnt: number }
  const row = await dbQuerySingle<C>(
    `SELECT COUNT(*) AS cnt FROM social_posts WHERE character_id = ? AND deleted_at IS NULL`,
    [characterId]
  );
  return Number(row?.cnt ?? 0);
}
