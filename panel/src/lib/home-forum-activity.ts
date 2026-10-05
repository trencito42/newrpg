import { dbQuery } from "@/lib/db";
import { canAccessForum } from "@/lib/forum-permissions";
import { forumAuthorKey, resolveForumAuthorIdentities } from "@/lib/forum-author-identity";
import type { Forum } from "@/lib/forum-types";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";
import type { UserSession } from "@/lib/types";
import type { RowDataPacket } from "mysql2";

export interface HomeForumActivityItem {
  postId: number;
  topicId: number;
  topicSlug: string;
  topicTitle: string;
  forumName: string;
  replyCount: number;
  isFirstPost: boolean;
  excerpt: string;
  createdAt: string;
  authorUsername: string;
  authorIdentity: ResolvedPlayerIdentity | null;
  href: string;
}

interface ForumRow extends RowDataPacket, Forum {}

interface ActivityRow extends RowDataPacket {
  post_id: number;
  topic_id: number;
  topic_slug: string;
  topic_title: string;
  forum_name: string;
  reply_count: number;
  is_first_post: number;
  content: string;
  created_at: string;
  author_username: string;
  account_id: number;
  author_character_id: number | null;
}

function plainExcerpt(html: string, max = 120): string {
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max - 1)}…`;
}

export async function getAccessibleForumIds(session: UserSession | null): Promise<number[]> {
  const forums = await dbQuery<ForumRow>(`SELECT * FROM panel_forums WHERE is_visible = 1 ORDER BY sort_order ASC`);
  const checks = await Promise.all(
    forums.map(async (f) => ({
      id: f.id,
      ok: await canAccessForum(session, { ...f, is_locked: Boolean(f.is_locked), is_visible: Boolean(f.is_visible) }),
    }))
  );
  return checks.filter((c) => c.ok).map((c) => c.id);
}

export async function fetchHomeForumActivity(
  session: UserSession | null,
  limit: number
): Promise<HomeForumActivityItem[]> {
  const forumIds = await getAccessibleForumIds(session);
  if (forumIds.length === 0) return [];

  const placeholders = forumIds.map(() => "?").join(",");
  const rows = await dbQuery<ActivityRow>(
    `SELECT p.id AS post_id, p.topic_id, t.slug AS topic_slug, t.title AS topic_title,
            f.name AS forum_name, t.reply_count, p.is_first_post, p.content, p.created_at,
            p.author_username, p.account_id, p.author_character_id
     FROM panel_forum_posts p
     INNER JOIN panel_forum_topics t ON t.id = p.topic_id AND t.deleted_at IS NULL
     INNER JOIN panel_forums f ON f.id = p.forum_id
     WHERE p.deleted_at IS NULL
       AND p.forum_id IN (${placeholders})
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [...forumIds, limit]
  );

  const authorRefs = rows.map((r) => ({
    accountId: r.account_id,
    characterId: r.author_character_id,
    username: r.author_username,
  }));
  const identityMap = await resolveForumAuthorIdentities(authorRefs);

  return rows.map((r) => {
    const key = forumAuthorKey({
      accountId: r.account_id,
      characterId: r.author_character_id,
      username: r.author_username,
    });
    return {
      postId: r.post_id,
      topicId: r.topic_id,
      topicSlug: r.topic_slug,
      topicTitle: r.topic_title,
      forumName: r.forum_name,
      replyCount: Number(r.reply_count) || 0,
      isFirstPost: Boolean(r.is_first_post),
      excerpt: plainExcerpt(r.content),
      createdAt: r.created_at,
      authorUsername: r.author_username,
      authorIdentity: identityMap.get(key) ?? null,
      href: `/forum/topic/${r.topic_id}/${r.topic_slug}#post-${r.post_id}`,
    };
  });
}
