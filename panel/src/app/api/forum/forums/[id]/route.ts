import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbQuery } from "@/lib/db";
import { getForumPermissions } from "@/lib/forum-permissions";
import type { Forum, ForumTopicListItem } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface ForumRow extends RowDataPacket, Forum {}

interface TopicRow extends RowDataPacket {
  id: number;
  forum_id: number;
  account_id: number;
  author_character_id: number | null;
  author_username: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  view_count: number;
  reply_count: number;
  last_post_id: number | null;
  last_post_at: string | null;
  last_post_account_id: number | null;
  last_post_character_id: number | null;
  last_post_username: string | null;
  has_poll: number;
  created_at: string;
  deleted_at: string | null;
  last_read_post_id: number | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const forumId = parseInt(id, 10);
    if (!Number.isFinite(forumId)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const session = await getCurrentSession();

    const forum = await dbQuerySingle<ForumRow>(
      `SELECT id, category_id, parent_forum_id, name, slug, description, icon,
              access_type, access_target, inherit_category_permissions, sort_order, is_locked, is_visible,
              topic_count, post_count, last_topic_id, last_topic_title,
              last_post_id, last_post_at, last_post_account_id, last_post_character_id, last_post_username, topic_template, created_at
       FROM panel_forums WHERE id = ? LIMIT 1`,
      [forumId]
    );

    if (!forum) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const permissions = await getForumPermissions(session, forum);
    if (!permissions.canView) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const offset = (page - 1) * PAGE_SIZE;
    const isMod = permissions.canModerate;

    const accountId = session?.accountId ?? 0;

    const topics = await dbQuery<TopicRow>(
      `SELECT t.*,
              tr.last_read_post_id
       FROM panel_forum_topics t
       LEFT JOIN panel_forum_topic_reads tr ON tr.topic_id = t.id AND tr.account_id = ?
       WHERE t.forum_id = ?
         AND (t.deleted_at IS NULL ${isMod ? "OR t.deleted_at IS NOT NULL" : ""})
       ORDER BY
         FIELD(t.type,'global','announcement','pinned','normal'),
         t.last_post_at DESC
       LIMIT ? OFFSET ?`,
      [accountId, forumId, PAGE_SIZE, offset]
    );

    interface CountRow extends RowDataPacket { total: number }
    const countRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS total FROM panel_forum_topics
       WHERE forum_id = ?
         AND (deleted_at IS NULL ${isMod ? "OR deleted_at IS NOT NULL" : ""})`,
      [forumId]
    );
    const totalTopics = countRow?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalTopics / PAGE_SIZE));

    const topicList: ForumTopicListItem[] = topics.map((t) => ({
      id: t.id,
      forum_id: t.forum_id,
      account_id: t.account_id,
      author_character_id: t.author_character_id,
      author_username: t.author_username,
      title: t.title,
      slug: t.slug,
      type: t.type as ForumTopicListItem["type"],
      status: t.status as ForumTopicListItem["status"],
      view_count: t.view_count,
      reply_count: t.reply_count,
      last_post_id: t.last_post_id,
      last_post_at: t.last_post_at,
      last_post_account_id: t.last_post_account_id,
      last_post_character_id: t.last_post_character_id,
      last_post_username: t.last_post_username,
      has_poll: Boolean(t.has_poll),
      template_data: null,
      created_at: t.created_at,
      deleted_at: t.deleted_at,
      deleted_by_account_id: null,
      delete_reason: null,
      last_read_post_id: t.last_read_post_id ?? null,
      is_unread:
        accountId > 0 && t.last_post_id != null
          ? (t.last_read_post_id ?? 0) < (t.last_post_id ?? 0)
          : false,
    }));

    return NextResponse.json({
      forum: {
        ...forum,
        is_locked: Boolean(forum.is_locked),
        is_visible: Boolean(forum.is_visible),
      },
      permissions,
      topics: topicList,
      totalTopics,
      page,
      totalPages,
    });
  } catch (err) {
    console.error("[forum/forums/[id]] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
