import { dbQuery, dbQuerySingle } from "@/lib/db";
import { canAccessForum } from "@/lib/forum-permissions";
import { fetchSocialPostsForCharacter, type FeedPost } from "@/lib/social-feed";
import type { Forum } from "@/lib/forum-types";
import type { UserSession } from "@/lib/types";
import type { RowDataPacket } from "mysql2";

export interface CharacterCommunityCounts {
  feedPosts: number;
  forumPosts: number;
  forumTopics: number;
}

export type CommunityActivityKind = "social_post" | "forum_topic" | "forum_reply";

export interface CommunityActivityEntry {
  type: CommunityActivityKind;
  id: number;
  createdAt: string;
  href: string;
  socialPost?: FeedPost;
  forumTopicTitle?: string;
  forumName?: string;
  forumExcerpt?: string;
}

interface ForumRow extends RowDataPacket, Forum {}

interface ForumPostRow extends RowDataPacket {
  id: number;
  topic_id: number;
  forum_id: number;
  is_first_post: number;
  content: string;
  created_at: string;
  topic_title: string;
  topic_slug: string;
  forum_name: string;
}

function plainExcerpt(html: string, max = 140): string {
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max - 1)}…`;
}

async function filterForumRowsByViewerAccess(
  session: UserSession | null,
  rows: ForumPostRow[]
): Promise<ForumPostRow[]> {
  if (rows.length === 0) return [];
  const forumIds = [...new Set(rows.map((r) => r.forum_id))];
  const forums = await dbQuery<ForumRow>(
    `SELECT * FROM panel_forums WHERE id IN (${forumIds.map(() => "?").join(",")})`,
    forumIds
  );
  const forumMap = new Map(forums.map((f) => [f.id, f]));
  const access = new Map<number, boolean>();
  await Promise.all(
    forumIds.map(async (id) => {
      const forum = forumMap.get(id);
      if (!forum) {
        access.set(id, false);
        return;
      }
      access.set(
        id,
        await canAccessForum(session, {
          ...forum,
          is_locked: Boolean(forum.is_locked),
          is_visible: Boolean(forum.is_visible),
        })
      );
    })
  );
  return rows.filter((r) => access.get(r.forum_id));
}

export async function getCharacterCommunityCounts(characterId: number): Promise<CharacterCommunityCounts> {
  interface C extends RowDataPacket { cnt: number }
  const [feedRow, forumPostsRow, topicsRow] = await Promise.all([
    dbQuerySingle<C>(
      `SELECT COUNT(*) AS cnt FROM social_posts WHERE character_id = ? AND deleted_at IS NULL`,
      [characterId]
    ),
    dbQuerySingle<C>(
      `SELECT COUNT(*) AS cnt FROM panel_forum_posts
       WHERE author_character_id = ? AND deleted_at IS NULL`,
      [characterId]
    ),
    dbQuerySingle<C>(
      `SELECT COUNT(*) AS cnt FROM panel_forum_topics
       WHERE author_character_id = ? AND deleted_at IS NULL`,
      [characterId]
    ),
  ]);
  return {
    feedPosts: Number(feedRow?.cnt ?? 0),
    forumPosts: Number(forumPostsRow?.cnt ?? 0),
    forumTopics: Number(topicsRow?.cnt ?? 0),
  };
}

export async function fetchCharacterForumActivity(
  characterId: number,
  session: UserSession | null,
  limit: number
): Promise<CommunityActivityEntry[]> {
  const rows = await dbQuery<ForumPostRow>(
    `SELECT p.id, p.topic_id, p.forum_id, p.is_first_post, p.content, p.created_at,
            t.title AS topic_title, t.slug AS topic_slug, f.name AS forum_name
     FROM panel_forum_posts p
     INNER JOIN panel_forum_topics t ON t.id = p.topic_id AND t.deleted_at IS NULL
     INNER JOIN panel_forums f ON f.id = p.forum_id
     WHERE p.deleted_at IS NULL AND p.author_character_id = ?
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [characterId, Math.min(limit, 40)]
  );

  const visible = await filterForumRowsByViewerAccess(session, rows);

  return visible.map((r) => ({
    type: r.is_first_post ? "forum_topic" : "forum_reply",
    id: r.id,
    createdAt: r.created_at,
    href: `/forum/topic/${r.topic_id}/${r.topic_slug}#post-${r.id}`,
    forumTopicTitle: r.topic_title,
    forumName: r.forum_name,
    forumExcerpt: plainExcerpt(r.content),
  }));
}

export async function fetchCharacterCommunityActivity(
  characterId: number,
  session: UserSession | null,
  opts?: { limit?: number; viewerCharId?: number | null }
): Promise<{
  entries: CommunityActivityEntry[];
  counts: CharacterCommunityCounts;
  feedPosts: FeedPost[];
}> {
  const limit = opts?.limit ?? 12;
  const viewerCharId = opts?.viewerCharId ?? null;

  const [counts, feedPosts, forumEntries] = await Promise.all([
    getCharacterCommunityCounts(characterId),
    fetchSocialPostsForCharacter(characterId, limit, viewerCharId),
    fetchCharacterForumActivity(characterId, session, limit),
  ]);

  const socialEntries: CommunityActivityEntry[] = feedPosts.map((p) => ({
    type: "social_post",
    id: p.id,
    createdAt: p.created_at,
    href: `/feed#post-${p.id}`,
    socialPost: p,
  }));

  const merged = [...socialEntries, ...forumEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    entries: merged.slice(0, limit),
    counts,
    feedPosts,
  };
}
