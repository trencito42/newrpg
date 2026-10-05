import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "topics";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  try {
    interface CountRow extends RowDataPacket { total: number }

    if (tab === "topics") {
      interface TopicRow extends RowDataPacket {
        id: number;
        forum_id: number;
        title: string;
        slug: string;
        type: string;
        status: string;
        reply_count: number;
        view_count: number;
        last_post_at: string | null;
        last_post_username: string | null;
        created_at: string;
        deleted_at: string | null;
        forum_name: string;
      }

      const items = await dbQuery<TopicRow>(
        `SELECT t.id, t.forum_id, t.title, t.slug, t.type, t.status,
                t.reply_count, t.view_count, t.last_post_at, t.last_post_username,
                t.created_at, t.deleted_at, f.name AS forum_name
         FROM panel_forum_topics t
         JOIN panel_forums f ON f.id = t.forum_id
         WHERE t.account_id = ? AND t.deleted_at IS NULL
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        [session.accountId, PAGE_SIZE, offset]
      );

      const countRow = await dbQuerySingle<CountRow>(
        `SELECT COUNT(*) AS total FROM panel_forum_topics WHERE account_id = ? AND deleted_at IS NULL`,
        [session.accountId]
      );

      return NextResponse.json({
        items,
        total: countRow?.total ?? 0,
        page,
        totalPages: Math.max(1, Math.ceil((countRow?.total ?? 0) / PAGE_SIZE)),
      });
    }

    if (tab === "posts") {
      interface PostRow extends RowDataPacket {
        id: number;
        topic_id: number;
        topic_title: string;
        topic_slug: string;
        forum_id: number;
        forum_name: string;
        content: string;
        created_at: string;
        deleted_at: string | null;
      }

      const items = await dbQuery<PostRow>(
        `SELECT p.id, p.topic_id, t.title AS topic_title, t.slug AS topic_slug,
                p.forum_id, f.name AS forum_name,
                SUBSTRING(p.content, 1, 300) AS content,
                p.created_at, p.deleted_at
         FROM panel_forum_posts p
         JOIN panel_forum_topics t ON t.id = p.topic_id
         JOIN panel_forums f ON f.id = p.forum_id
         WHERE p.account_id = ? AND p.deleted_at IS NULL AND p.is_first_post = 0
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [session.accountId, PAGE_SIZE, offset]
      );

      const countRow = await dbQuerySingle<CountRow>(
        `SELECT COUNT(*) AS total FROM panel_forum_posts
         WHERE account_id = ? AND deleted_at IS NULL AND is_first_post = 0`,
        [session.accountId]
      );

      return NextResponse.json({
        items,
        total: countRow?.total ?? 0,
        page,
        totalPages: Math.max(1, Math.ceil((countRow?.total ?? 0) / PAGE_SIZE)),
      });
    }

    if (tab === "bookmarks") {
      interface BmRow extends RowDataPacket {
        id: number;
        topic_id: number;
        title: string;
        slug: string;
        reply_count: number;
        last_post_at: string | null;
        forum_name: string;
        bookmarked_at: string;
      }

      const items = await dbQuery<BmRow>(
        `SELECT b.id, b.topic_id, t.title, t.slug, t.reply_count, t.last_post_at,
                f.name AS forum_name, b.created_at AS bookmarked_at
         FROM panel_forum_bookmarks b
         JOIN panel_forum_topics t ON t.id = b.topic_id
         JOIN panel_forums f ON f.id = t.forum_id
         WHERE b.account_id = ? AND t.deleted_at IS NULL
         ORDER BY b.created_at DESC
         LIMIT ? OFFSET ?`,
        [session.accountId, PAGE_SIZE, offset]
      );

      const countRow = await dbQuerySingle<CountRow>(
        `SELECT COUNT(*) AS total FROM panel_forum_bookmarks b
         JOIN panel_forum_topics t ON t.id = b.topic_id
         WHERE b.account_id = ? AND t.deleted_at IS NULL`,
        [session.accountId]
      );

      return NextResponse.json({
        items,
        total: countRow?.total ?? 0,
        page,
        totalPages: Math.max(1, Math.ceil((countRow?.total ?? 0) / PAGE_SIZE)),
      });
    }

    if (tab === "subscriptions") {
      interface SubRow extends RowDataPacket {
        id: number;
        topic_id: number;
        title: string;
        slug: string;
        reply_count: number;
        last_post_at: string | null;
        last_post_username: string | null;
        forum_name: string;
        subscribed_at: string;
      }

      const items = await dbQuery<SubRow>(
        `SELECT s.id, s.topic_id, t.title, t.slug, t.reply_count, t.last_post_at,
                t.last_post_username, f.name AS forum_name, s.created_at AS subscribed_at
         FROM panel_forum_subscriptions s
         JOIN panel_forum_topics t ON t.id = s.topic_id
         JOIN panel_forums f ON f.id = t.forum_id
         WHERE s.account_id = ? AND t.deleted_at IS NULL
         ORDER BY t.last_post_at DESC
         LIMIT ? OFFSET ?`,
        [session.accountId, PAGE_SIZE, offset]
      );

      const countRow = await dbQuerySingle<CountRow>(
        `SELECT COUNT(*) AS total FROM panel_forum_subscriptions s
         JOIN panel_forum_topics t ON t.id = s.topic_id
         WHERE s.account_id = ? AND t.deleted_at IS NULL`,
        [session.accountId]
      );

      return NextResponse.json({
        items,
        total: countRow?.total ?? 0,
        page,
        totalPages: Math.max(1, Math.ceil((countRow?.total ?? 0) / PAGE_SIZE)),
      });
    }

    return NextResponse.json({ error: "invalid_tab" }, { status: 400 });
  } catch (err) {
    console.error("[forum/my] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
