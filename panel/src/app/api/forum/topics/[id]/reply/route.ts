import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbQuery, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { canAccessForum } from "@/lib/forum-permissions";
import { renderForumContent, extractMentions } from "@/lib/forum-markdown";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";
import type { Forum, ForumTopic } from "@/lib/forum-types";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface ForumRow extends RowDataPacket, Forum {}
interface TopicRow extends RowDataPacket, ForumTopic {}

const ReplySchema = z.object({
  content: z.string().min(2).max(50000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const topicId = parseInt(id, 10);
  if (!Number.isFinite(topicId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const topic = await dbQuerySingle<TopicRow>(
      `SELECT * FROM panel_forum_topics WHERE id = ? LIMIT 1`,
      [topicId]
    );

    if (!topic || topic.deleted_at) {
      return NextResponse.json({ error: "topic_not_found" }, { status: 404 });
    }

    if (topic.status === "locked") {
      return NextResponse.json({ error: "topic_locked" }, { status: 403 });
    }

    const forum = await dbQuerySingle<ForumRow>(
      `SELECT * FROM panel_forums WHERE id = ? LIMIT 1`,
      [topic.forum_id]
    );

    if (!forum) {
      return NextResponse.json({ error: "forum_not_found" }, { status: 404 });
    }

    if (forum.is_locked) {
      return NextResponse.json({ error: "forum_locked" }, { status: 403 });
    }

    const accessible = await canAccessForum(session, forum);
    if (!accessible) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const renderedContent = renderForumContent(parsed.data.content);

    const postId = await dbTransaction(async (conn) => {
      const [postResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO panel_forum_posts
           (topic_id, forum_id, account_id, author_username, content, is_first_post, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`,
        [topicId, topic.forum_id, session.accountId, session.username, renderedContent]
      );
      const newPostId = postResult.insertId;

      await conn.execute(
        `UPDATE panel_forum_topics
         SET reply_count = reply_count + 1,
             last_post_id = ?,
             last_post_at = NOW(),
             last_post_account_id = ?,
             last_post_username = ?
         WHERE id = ?`,
        [newPostId, session.accountId, session.username, topicId]
      );

      await conn.execute(
        `UPDATE panel_forums
         SET post_count = post_count + 1,
             last_post_at = NOW(),
             last_post_account_id = ?,
             last_post_username = ?
         WHERE id = ?`,
        [session.accountId, session.username, topic.forum_id]
      );

      return newPostId;
    });

    // Auto-subscribe author
    dbQuerySingle(
      `INSERT IGNORE INTO panel_forum_subscriptions (account_id, topic_id) VALUES (?, ?)`,
      [session.accountId, topicId]
    ).catch(() => {});

    // Notify subscribers (except the replier)
    interface SubRow extends RowDataPacket { account_id: number }
    const subscribers = await dbQuery<SubRow>(
      `SELECT account_id FROM panel_forum_subscriptions WHERE topic_id = ? AND account_id != ?`,
      [topicId, session.accountId]
    );

    await Promise.allSettled(
      subscribers.map((sub) =>
        createNotification({
          accountId: sub.account_id,
          type: "forum_reply",
          titleEn: "New reply in subscribed topic",
          titleRo: "Răspuns nou în topicul abonat",
          messageEn: `${session.username} replied in "${topic.title}"`,
          messageRo: `${session.username} a răspuns în "${topic.title}"`,
          linkUrl: `/forum/topic/${topicId}/${topic.slug}`,
        })
      )
    );

    // Notify @mentions (skip subscribers who already got notified)
    const subscriberIds = new Set(subscribers.map((s) => s.account_id));
    const mentions = extractMentions(parsed.data.content);
    if (mentions.length > 0) {
      interface AccRow extends RowDataPacket { id: number }
      const mentioned = await dbQuery<AccRow>(
        `SELECT id FROM accounts WHERE username IN (${mentions.map(() => "?").join(",")}) LIMIT 20`,
        mentions
      );
      await Promise.allSettled(
        mentioned
          .filter((a) => a.id !== session.accountId && !subscriberIds.has(a.id))
          .map((a) =>
            createNotification({
              accountId: a.id,
              type: "forum_mention",
              titleEn: "You were mentioned",
              titleRo: "Ai fost menționat",
              messageEn: `${session.username} mentioned you in "${topic.title}"`,
              messageRo: `${session.username} te-a menționat în "${topic.title}"`,
              linkUrl: `/forum/topic/${topicId}/${topic.slug}`,
            })
          )
      );
    }

    // Calculate page number for the new post
    interface CountRow extends RowDataPacket { total: number }
    const countRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS total FROM panel_forum_posts WHERE topic_id = ? AND deleted_at IS NULL`,
      [topicId]
    );
    const totalPosts = countRow?.total ?? 1;
    const page = Math.ceil(totalPosts / PAGE_SIZE);

    return NextResponse.json({ postId, page });
  } catch (err) {
    console.error("[forum/topics/[id]/reply] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
