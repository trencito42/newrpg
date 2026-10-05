import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { canAccessForum } from "@/lib/forum-permissions";
import { renderForumContent, slugify, extractMentions } from "@/lib/forum-markdown";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";
import type { Forum } from "@/lib/forum-types";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

interface ForumRow extends RowDataPacket, Forum {}

const PollOptionSchema = z.object({
  label: z.string().min(1).max(200),
});

const CreateTopicSchema = z.object({
  forumId: z.number().int().positive(),
  title: z.string().min(5).max(200),
  content: z.string().min(10).max(50000),
  type: z.enum(["normal", "pinned", "announcement", "global"]).optional().default("normal"),
  poll: z
    .object({
      question: z.string().min(5).max(255),
      options: z.array(PollOptionSchema).min(2).max(20),
      max_selections: z.number().int().min(1).max(10).optional().default(1),
      allows_change: z.boolean().optional().default(false),
      closes_at: z.string().nullable().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  try {
    const forum = await dbQuerySingle<ForumRow>(
      `SELECT * FROM panel_forums WHERE id = ? LIMIT 1`,
      [data.forumId]
    );

    if (!forum) {
      return NextResponse.json({ error: "forum_not_found" }, { status: 404 });
    }

    const accessible = await canAccessForum(session, forum);
    if (!accessible) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (forum.is_locked) {
      return NextResponse.json({ error: "forum_locked" }, { status: 403 });
    }

    // Only mods can create pinned/announcement/global topics
    const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
    let topicType = data.type;
    if (
      (topicType === "pinned" || topicType === "announcement" || topicType === "global") &&
      !isMod
    ) {
      topicType = "normal";
    }

    const slug = slugify(data.title) || `topic-${Date.now()}`;
    const renderedContent = renderForumContent(data.content);
    const hasPoll = data.poll ? 1 : 0;

    const result = await dbTransaction(async (conn) => {
      // Insert topic
      const [topicResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO panel_forum_topics
           (forum_id, account_id, author_username, title, slug, type, status, has_poll, created_at, last_post_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NOW(), NOW())`,
        [data.forumId, session.accountId, session.username, data.title, slug, topicType, hasPoll]
      );
      const topicId = topicResult.insertId;

      // Insert first post
      const [postResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO panel_forum_posts
           (topic_id, forum_id, account_id, author_username, content, is_first_post, created_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [topicId, data.forumId, session.accountId, session.username, renderedContent]
      );
      const postId = postResult.insertId;

      // Update topic with first post reference
      await conn.execute(
        `UPDATE panel_forum_topics
         SET last_post_id = ?, last_post_at = NOW(), last_post_account_id = ?, last_post_username = ?
         WHERE id = ?`,
        [postId, session.accountId, session.username, topicId]
      );

      // Update forum counters
      await conn.execute(
        `UPDATE panel_forums
         SET topic_count = topic_count + 1,
             post_count = post_count + 1,
             last_topic_id = ?,
             last_topic_title = ?,
             last_post_at = NOW(),
             last_post_account_id = ?,
             last_post_username = ?
         WHERE id = ?`,
        [topicId, data.title.slice(0, 128), session.accountId, session.username, data.forumId]
      );

      // Create poll if provided
      if (data.poll) {
        const [pollResult] = await conn.execute<ResultSetHeader>(
          `INSERT INTO panel_forum_polls (topic_id, question, max_selections, allows_change, closes_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            topicId,
            data.poll.question,
            data.poll.max_selections,
            data.poll.allows_change ? 1 : 0,
            data.poll.closes_at ?? null,
          ]
        );
        const pollId = pollResult.insertId;

        for (let i = 0; i < data.poll.options.length; i++) {
          await conn.execute(
            `INSERT INTO panel_forum_poll_options (poll_id, label, sort_order) VALUES (?, ?, ?)`,
            [pollId, data.poll.options[i].label, i]
          );
        }
      }

      return { topicId, slug };
    });

    // Auto-subscribe author
    try {
      await dbQuerySingle(
        `INSERT IGNORE INTO panel_forum_subscriptions (account_id, topic_id) VALUES (?, ?)`,
        [session.accountId, result.topicId]
      );
    } catch {
      // Non-critical
    }

    // Notify @mentions
    const mentions = extractMentions(data.content);
    if (mentions.length > 0) {
      const mentionedUsers = await dbQuerySingle<{ ids: string }>(
        `SELECT GROUP_CONCAT(id) AS ids FROM accounts WHERE username IN (${mentions.map(() => "?").join(",")}) LIMIT 20`,
        mentions
      );
      if (mentionedUsers?.ids) {
        const ids = mentionedUsers.ids.split(",").map(Number);
        await Promise.allSettled(
          ids.map((accountId) =>
            createNotification({
              accountId,
              type: "forum_mention",
              titleEn: "You were mentioned",
              titleRo: "Ai fost menționat",
              messageEn: `${session.username} mentioned you in "${data.title}"`,
              messageRo: `${session.username} te-a menționat în "${data.title}"`,
              linkUrl: `/forum/topic/${result.topicId}/${result.slug}`,
            })
          )
        );
      }
    }

    return NextResponse.json({ topicId: result.topicId, slug: result.slug });
  } catch (err) {
    console.error("[forum/topics] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
