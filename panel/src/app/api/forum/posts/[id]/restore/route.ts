import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import type { Forum } from "@/lib/forum-types";
import { canModerateForum } from "@/lib/forum-permissions";
import { refreshForumStats, refreshForumTopicStats } from "@/lib/forum-stats";

export const dynamic = "force-dynamic";

interface PostRow extends RowDataPacket {
  id: number;
  topic_id: number;
  forum_id: number;
  is_first_post: number;
  deleted_at: string | null;
}

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
  const postId = parseInt(id, 10);
  if (!Number.isFinite(postId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const post = await dbQuerySingle<PostRow>(
      `SELECT id, topic_id, forum_id, is_first_post, deleted_at
       FROM panel_forum_posts WHERE id = ? LIMIT 1`,
      [postId]
    );

    if (!post) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const forum = await dbQuerySingle<RowDataPacket & Forum>("SELECT * FROM panel_forums WHERE id = ? LIMIT 1", [post.forum_id]);
    if (!forum || !(await canModerateForum(session, forum))) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!post.deleted_at) {
      return NextResponse.json({ error: "post_not_deleted" }, { status: 400 });
    }

    await dbExecute(
      `UPDATE panel_forum_posts
       SET deleted_at = NULL, deleted_by_account_id = NULL, delete_reason = NULL
       WHERE id = ?`,
      [postId]
    );

    if (post.is_first_post) {
      // Restore the topic as well
      await dbExecute(
        `UPDATE panel_forum_topics
         SET deleted_at = NULL, deleted_by_account_id = NULL, delete_reason = NULL
         WHERE id = ?`,
        [post.topic_id]
      );
    } else {
      // Increment reply count back
      await dbExecute(
        `UPDATE panel_forum_topics SET reply_count = reply_count + 1 WHERE id = ?`,
        [post.topic_id]
      );
    }

    // Increment forum post count back
    await dbExecute(
      `UPDATE panel_forums SET post_count = post_count + 1 WHERE id = ?`,
      [post.forum_id]
    );

    await refreshForumTopicStats(post.topic_id);
    await refreshForumStats(post.forum_id);

    await dbExecute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'restore_post', 'post', ?)`,
      [session.accountId, session.username, postId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/posts/[id]/restore] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
