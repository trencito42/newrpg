import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { renderForumContent } from "@/lib/forum-markdown";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PostRow extends RowDataPacket {
  id: number;
  topic_id: number;
  forum_id: number;
  account_id: number;
  is_first_post: number;
  content: string;
  created_at: string;
  deleted_at: string | null;
}

interface TopicRow extends RowDataPacket {
  id: number;
  reply_count: number;
  forum_id: number;
}

const EditSchema = z.object({
  content: z.string().min(2).max(50000),
  reason: z.string().max(255).optional(),
});

const DeleteSchema = z.object({
  reason: z.string().max(500).optional(),
});

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

  const { id } = await params;
  const postId = parseInt(id, 10);
  if (!Number.isFinite(postId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const post = await dbQuerySingle<PostRow>(
      `SELECT id, topic_id, forum_id, account_id, is_first_post, content, created_at, deleted_at
       FROM panel_forum_posts WHERE id = ? LIMIT 1`,
      [postId]
    );

    if (!post || post.deleted_at) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
    const isOwner = post.account_id === session.accountId;

    if (!isMod && !isOwner) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Non-mods can only edit within 24h
    if (!isMod && isOwner) {
      const createdAt = new Date(post.created_at).getTime();
      if (Date.now() - createdAt > EDIT_WINDOW_MS) {
        return NextResponse.json({ error: "edit_window_expired" }, { status: 403 });
      }
    }

    // Save history
    await dbExecute(
      `INSERT INTO panel_forum_post_history (post_id, editor_account_id, old_content, reason)
       VALUES (?, ?, ?, ?)`,
      [postId, session.accountId, post.content, parsed.data.reason ?? null]
    );

    const renderedContent = renderForumContent(parsed.data.content);

    await dbExecute(
      `UPDATE panel_forum_posts
       SET content = ?, edited_at = NOW(), edited_by_account_id = ?, edit_reason = ?
       WHERE id = ?`,
      [renderedContent, session.accountId, parsed.data.reason ?? null, postId]
    );

    if (isMod && !isOwner) {
      await dbExecute(
        `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id, reason)
         VALUES (?, ?, 'edit_post', 'post', ?, ?)`,
        [session.accountId, session.username, postId, parsed.data.reason ?? null]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/posts/[id]] PATCH error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
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
  const postId = parseInt(id, 10);
  if (!Number.isFinite(postId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const post = await dbQuerySingle<PostRow>(
      `SELECT id, topic_id, forum_id, account_id, is_first_post, content, created_at, deleted_at
       FROM panel_forum_posts WHERE id = ? LIMIT 1`,
      [postId]
    );

    if (!post || post.deleted_at) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
    const isOwner = post.account_id === session.accountId;

    if (!isMod && !isOwner) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // First post can only be deleted by mods (which deletes the whole topic)
    if (post.is_first_post && !isMod) {
      return NextResponse.json({ error: "cannot_delete_first_post" }, { status: 403 });
    }

    const reason = parsed.data.reason ?? null;

    await dbTransaction(async (conn) => {
      // Soft-delete the post
      await conn.execute(
        `UPDATE panel_forum_posts
         SET deleted_at = NOW(), deleted_by_account_id = ?, delete_reason = ?
         WHERE id = ?`,
        [session.accountId, reason, postId]
      );

      if (post.is_first_post) {
        // Delete the whole topic
        await conn.execute(
          `UPDATE panel_forum_topics
           SET deleted_at = NOW(), deleted_by_account_id = ?, delete_reason = ?
           WHERE id = ?`,
          [session.accountId, reason, post.topic_id]
        );
      } else {
        // Decrement reply count
        await conn.execute(
          `UPDATE panel_forum_topics
           SET reply_count = GREATEST(0, reply_count - 1)
           WHERE id = ?`,
          [post.topic_id]
        );
      }

      // Decrement forum post count
      await conn.execute(
        `UPDATE panel_forums SET post_count = GREATEST(0, post_count - 1) WHERE id = ?`,
        [post.forum_id]
      );
    });

    if (isMod) {
      await dbExecute(
        `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id, reason)
         VALUES (?, ?, 'delete_post', 'post', ?, ?)`,
        [session.accountId, session.username, postId, reason]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/posts/[id]] DELETE error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
