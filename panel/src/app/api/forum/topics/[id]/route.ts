import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbQuery, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { canAccessForum } from "@/lib/forum-permissions";
import { z } from "zod";
import type { Forum, ForumTopic, ForumPostItem } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface ForumRow extends RowDataPacket, Forum {}

interface TopicRow extends RowDataPacket {
  id: number;
  forum_id: number;
  account_id: number;
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
  last_post_username: string | null;
  has_poll: number;
  template_data: Record<string, unknown> | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_account_id: number | null;
  delete_reason: string | null;
}

interface PostRow extends RowDataPacket {
  id: number;
  topic_id: number;
  forum_id: number;
  account_id: number;
  author_username: string;
  content: string;
  is_first_post: number;
  edited_at: string | null;
  edited_by_account_id: number | null;
  edit_reason: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_account_id: number | null;
  delete_reason: string | null;
  author_admin_level: number;
  author_helper_level: number;
  author_post_count: number;
  author_joined_at: string;
  deleted_by_username: string | null;
  edited_by_username: string | null;
}

const ModActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock") }),
  z.object({ action: z.literal("unlock") }),
  z.object({ action: z.literal("pin") }),
  z.object({ action: z.literal("unpin") }),
  z.object({ action: z.literal("announce") }),
  z.object({ action: z.literal("global") }),
  z.object({ action: z.literal("normal") }),
  z.object({
    action: z.literal("delete"),
    reason: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal("restore") }),
  z.object({
    action: z.literal("move"),
    targetForumId: z.number().int().positive(),
  }),
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const topicId = parseInt(id, 10);
    if (!Number.isFinite(topicId)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const session = await getCurrentSession();
    const isMod = session && (session.adminLevel >= 1 || session.helperLevel >= 1);
    const accountId = session?.accountId ?? 0;

    const topic = await dbQuerySingle<TopicRow>(
      `SELECT * FROM panel_forum_topics WHERE id = ? LIMIT 1`,
      [topicId]
    );

    if (!topic) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (topic.deleted_at && !isMod) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const forum = await dbQuerySingle<ForumRow>(
      `SELECT * FROM panel_forums WHERE id = ? LIMIT 1`,
      [topic.forum_id]
    );

    if (!forum) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const accessible = await canAccessForum(session, forum);
    if (!accessible) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    let page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

    // postId param: resolve which page a specific post is on
    const postIdParam = url.searchParams.get("postId");
    if (postIdParam) {
      const postId = parseInt(postIdParam, 10);
      if (Number.isFinite(postId)) {
        interface PosRow extends RowDataPacket { pos: number }
        const posRow = await dbQuerySingle<PosRow>(
          `SELECT COUNT(*) AS pos
           FROM panel_forum_posts
           WHERE topic_id = ? AND id <= ?
             AND (deleted_at IS NULL ${isMod ? "OR deleted_at IS NOT NULL" : ""})`,
          [topicId, postId]
        );
        if (posRow) {
          page = Math.ceil(posRow.pos / PAGE_SIZE);
        }
      }
    }

    const offset = (page - 1) * PAGE_SIZE;

    const posts = await dbQuery<PostRow>(
      `SELECT p.*,
              a.admin_level AS author_admin_level,
              a.helper_level AS author_helper_level,
              (SELECT COUNT(*) FROM panel_forum_posts pp WHERE pp.account_id = p.account_id AND pp.deleted_at IS NULL) AS author_post_count,
              a.created_at AS author_joined_at,
              da.username AS deleted_by_username,
              ea.username AS edited_by_username
       FROM panel_forum_posts p
       JOIN accounts a ON a.id = p.account_id
       LEFT JOIN accounts da ON da.id = p.deleted_by_account_id
       LEFT JOIN accounts ea ON ea.id = p.edited_by_account_id
       WHERE p.topic_id = ?
         AND (p.deleted_at IS NULL ${isMod ? "OR p.deleted_at IS NOT NULL" : ""})
       ORDER BY p.created_at ASC
       LIMIT ? OFFSET ?`,
      [topicId, PAGE_SIZE, offset]
    );

    interface CountRow extends RowDataPacket { total: number }
    const countRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS total FROM panel_forum_posts
       WHERE topic_id = ?
         AND (deleted_at IS NULL ${isMod ? "OR deleted_at IS NOT NULL" : ""})`,
      [topicId]
    );
    const totalPosts = countRow?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));

    // Increment view count (fire-and-forget; one per session via simple approach)
    dbExecute(
      `UPDATE panel_forum_topics SET view_count = view_count + 1 WHERE id = ?`,
      [topicId]
    ).catch(() => {});

    // Mark topic as read if logged in
    if (session && posts.length > 0) {
      const lastPostId = posts[posts.length - 1].id;
      dbExecute(
        `INSERT INTO panel_forum_topic_reads (account_id, topic_id, last_read_post_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_read_post_id = GREATEST(last_read_post_id, ?), read_at = NOW()`,
        [session.accountId, topicId, lastPostId, lastPostId]
      ).catch(() => {});
    }

    // Load poll if topic has one
    let poll = null;
    if (topic.has_poll) {
      interface PollRow extends RowDataPacket {
        id: number;
        topic_id: number;
        question: string;
        max_selections: number;
        allows_change: number;
        closes_at: string | null;
        created_at: string;
      }
      const pollData = await dbQuerySingle<PollRow>(
        `SELECT * FROM panel_forum_polls WHERE topic_id = ? LIMIT 1`,
        [topicId]
      );
      if (pollData) {
        interface OptionRow extends RowDataPacket {
          id: number;
          poll_id: number;
          label: string;
          sort_order: number;
          votes_count: number;
        }
        const options = await dbQuery<OptionRow>(
          `SELECT * FROM panel_forum_poll_options WHERE poll_id = ? ORDER BY sort_order ASC`,
          [pollData.id]
        );

        let userVoteOptionIds: number[] = [];
        if (session) {
          interface VoteRow extends RowDataPacket { option_id: number }
          const votes = await dbQuery<VoteRow>(
            `SELECT option_id FROM panel_forum_poll_votes WHERE poll_id = ? AND account_id = ?`,
            [pollData.id, session.accountId]
          );
          userVoteOptionIds = votes.map((v) => v.option_id);
        }

        const totalVotes = options.reduce((sum, o) => sum + o.votes_count, 0);

        poll = {
          ...pollData,
          allows_change: Boolean(pollData.allows_change),
          options,
          user_vote_option_ids: userVoteOptionIds,
          total_votes: totalVotes,
        };
      }
    }

    const postList: ForumPostItem[] = posts.map((p) => ({
      id: p.id,
      topic_id: p.topic_id,
      forum_id: p.forum_id,
      account_id: p.account_id,
      author_username: p.author_username,
      content: p.deleted_at && !isMod ? "" : p.content,
      is_first_post: Boolean(p.is_first_post),
      edited_at: p.edited_at,
      edited_by_account_id: p.edited_by_account_id,
      edit_reason: p.edit_reason,
      created_at: p.created_at,
      deleted_at: p.deleted_at,
      deleted_by_account_id: p.deleted_by_account_id,
      delete_reason: isMod ? p.delete_reason : null,
      author_admin_level: p.author_admin_level,
      author_helper_level: p.author_helper_level,
      author_post_count: p.author_post_count,
      author_joined_at: p.author_joined_at,
      deleted_by_username: isMod ? p.deleted_by_username : null,
      edited_by_username: p.edited_by_username,
    }));

    const userCanReply =
      session !== null &&
      accessible &&
      !forum.is_locked &&
      topic.status === "open" &&
      !topic.deleted_at;

    return NextResponse.json({
      topic: {
        ...topic,
        has_poll: Boolean(topic.has_poll),
      },
      posts: postList,
      totalPosts,
      page,
      totalPages,
      userCanReply,
      userCanModerate: Boolean(isMod),
      poll,
    });
  } catch (err) {
    console.error("[forum/topics/[id]] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(
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

  const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
  if (!isMod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

  const parsed = ModActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  try {
    const topic = await dbQuerySingle<TopicRow>(
      `SELECT * FROM panel_forum_topics WHERE id = ? LIMIT 1`,
      [topicId]
    );

    if (!topic) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const logAction = async (action: string, reason?: string, metadata?: Record<string, unknown>) => {
      await dbExecute(
        `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id, reason, metadata)
         VALUES (?, ?, ?, 'topic', ?, ?, ?)`,
        [session.accountId, session.username, action, topicId, reason ?? null, metadata ? JSON.stringify(metadata) : null]
      );
    };

    switch (data.action) {
      case "lock":
        await dbExecute(`UPDATE panel_forum_topics SET status = 'locked' WHERE id = ?`, [topicId]);
        await logAction("lock_topic");
        break;

      case "unlock":
        await dbExecute(`UPDATE panel_forum_topics SET status = 'open' WHERE id = ?`, [topicId]);
        await logAction("unlock_topic");
        break;

      case "pin":
        await dbExecute(`UPDATE panel_forum_topics SET type = 'pinned' WHERE id = ?`, [topicId]);
        await logAction("pin_topic");
        break;

      case "unpin":
        await dbExecute(`UPDATE panel_forum_topics SET type = 'normal' WHERE id = ?`, [topicId]);
        await logAction("unpin_topic");
        break;

      case "announce":
        await dbExecute(`UPDATE panel_forum_topics SET type = 'announcement' WHERE id = ?`, [topicId]);
        await logAction("announce_topic");
        break;

      case "global":
        await dbExecute(`UPDATE panel_forum_topics SET type = 'global' WHERE id = ?`, [topicId]);
        await logAction("global_topic");
        break;

      case "normal":
        await dbExecute(`UPDATE panel_forum_topics SET type = 'normal' WHERE id = ?`, [topicId]);
        await logAction("set_normal_topic");
        break;

      case "delete": {
        const reason = data.action === "delete" ? (data as { action: "delete"; reason?: string }).reason : undefined;
        await dbExecute(
          `UPDATE panel_forum_topics SET deleted_at = NOW(), deleted_by_account_id = ?, delete_reason = ? WHERE id = ?`,
          [session.accountId, reason ?? null, topicId]
        );
        // Also soft-delete the first post
        await dbExecute(
          `UPDATE panel_forum_posts SET deleted_at = NOW(), deleted_by_account_id = ?, delete_reason = ? WHERE topic_id = ? AND is_first_post = 1`,
          [session.accountId, reason ?? null, topicId]
        );
        await logAction("delete_topic", reason);
        break;
      }

      case "restore":
        await dbExecute(
          `UPDATE panel_forum_topics SET deleted_at = NULL, deleted_by_account_id = NULL, delete_reason = NULL WHERE id = ?`,
          [topicId]
        );
        await dbExecute(
          `UPDATE panel_forum_posts SET deleted_at = NULL, deleted_by_account_id = NULL, delete_reason = NULL WHERE topic_id = ? AND is_first_post = 1`,
          [topicId]
        );
        await logAction("restore_topic");
        break;

      case "move": {
        const targetForumId = (data as { action: "move"; targetForumId: number }).targetForumId;
        const targetForum = await dbQuerySingle<ForumRow>(
          `SELECT * FROM panel_forums WHERE id = ? LIMIT 1`,
          [targetForumId]
        );
        if (!targetForum) {
          return NextResponse.json({ error: "target_forum_not_found" }, { status: 404 });
        }
        const oldForumId = topic.forum_id;

        await dbExecute(
          `UPDATE panel_forum_topics SET forum_id = ? WHERE id = ?`,
          [targetForumId, topicId]
        );
        await dbExecute(
          `UPDATE panel_forum_posts SET forum_id = ? WHERE topic_id = ?`,
          [targetForumId, topicId]
        );

        // Recalculate source forum counters
        await dbExecute(
          `UPDATE panel_forums f
           SET topic_count = (SELECT COUNT(*) FROM panel_forum_topics WHERE forum_id = f.id AND deleted_at IS NULL),
               post_count = (SELECT COUNT(*) FROM panel_forum_posts WHERE forum_id = f.id AND deleted_at IS NULL)
           WHERE f.id = ?`,
          [oldForumId]
        );
        // Recalculate target forum counters
        await dbExecute(
          `UPDATE panel_forums f
           SET topic_count = (SELECT COUNT(*) FROM panel_forum_topics WHERE forum_id = f.id AND deleted_at IS NULL),
               post_count = (SELECT COUNT(*) FROM panel_forum_posts WHERE forum_id = f.id AND deleted_at IS NULL)
           WHERE f.id = ?`,
          [targetForumId]
        );

        await logAction("move_topic", undefined, { from_forum_id: oldForumId, to_forum_id: targetForumId });
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/topics/[id]] PATCH error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
