import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

const MAX_COMMENT = 400;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const beforeId = req.nextUrl.searchParams.get("before_id") ? parseInt(req.nextUrl.searchParams.get("before_id")!) : null;
  const limit = 30;

  const extraWhere = beforeId ? " AND c.id < ?" : "";
  const queryParams: any[] = [postId];
  if (beforeId) queryParams.push(beforeId);
  queryParams.push(limit);

  interface CommentRow extends RowDataPacket {
    id: number; post_id: number; character_id: number; firstname: string; lastname: string;
    parent_comment_id: number | null; body: string; created_at: string; updated_at: string | null;
  }

  const comments = await dbQuery<CommentRow>(
    `SELECT c.id, c.post_id, c.character_id, ch.firstname, ch.lastname,
            c.parent_comment_id, c.body, c.created_at, c.updated_at
     FROM social_comments c
     JOIN characters ch ON ch.id = c.character_id
     WHERE c.post_id = ? AND c.deleted_at IS NULL${extraWhere}
     ORDER BY c.id ASC
     LIMIT ?`,
    queryParams
  );

  const nextCursor = comments.length === limit ? comments[comments.length - 1].id : null;
  return NextResponse.json({ comments, nextCursor });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const session = await getCurrentSession();
  if (!session?.selectedCharacterId) return NextResponse.json({ error: "no_character" }, { status: 401 });
  const charId = session.selectedCharacterId;

  const { id } = await params;
  const postId = parseInt(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  interface PostRow extends RowDataPacket { id: number; character_id: number; }
  const post = await dbQuerySingle<PostRow>(
    "SELECT id, character_id FROM social_posts WHERE id = ? AND deleted_at IS NULL",
    [postId]
  );
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let rawBody: string | null = null;
  let parentCommentId: number | null = null;
  try {
    const json = await req.json();
    rawBody = json.body;
    parentCommentId = json.parent_comment_id ? parseInt(json.parent_comment_id) : null;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = rawBody?.trim().replace(/\r/g, "") ?? "";
  if (!body) return NextResponse.json({ error: "empty_comment" }, { status: 422 });
  const cleanBody = body.length > MAX_COMMENT ? body.slice(0, MAX_COMMENT) : body;

  if (parentCommentId) {
    interface ParentRow extends RowDataPacket { id: number; post_id: number; parent_comment_id: number | null; }
    const parent = await dbQuerySingle<ParentRow>(
      "SELECT id, post_id, parent_comment_id FROM social_comments WHERE id = ? AND deleted_at IS NULL",
      [parentCommentId]
    );
    if (!parent || parent.post_id !== postId) return NextResponse.json({ error: "invalid_parent" }, { status: 422 });
    // Flatten: if replying to a reply, attach to root comment
    if (parent.parent_comment_id) parentCommentId = parent.parent_comment_id;
  }

  const result = await dbExecute(
    "INSERT INTO social_comments (post_id, character_id, parent_comment_id, body) VALUES (?, ?, ?, ?)",
    [postId, charId, parentCommentId, cleanBody]
  );
  const commentId = (result as any).insertId;

  // Notify post author
  if (post.character_id !== charId) {
    await dbExecute(
      "INSERT INTO social_notifications (character_id, actor_character_id, type, post_id, comment_id) VALUES (?, ?, 'comment', ?, ?)",
      [post.character_id, charId, postId, commentId]
    );
  }

  interface CountRow extends RowDataPacket { cnt: number; }
  const cm = await dbQuerySingle<CountRow>(
    "SELECT COUNT(*) AS cnt FROM social_comments WHERE post_id = ? AND deleted_at IS NULL",
    [postId]
  );

  return NextResponse.json({
    ok: true,
    commentId,
    commentsCount: cm ? Number(cm.cnt) : 0,
    comment: {
      id: commentId,
      post_id: postId,
      character_id: charId,
      parent_comment_id: parentCommentId,
      body: cleanBody,
      created_at: new Date().toISOString(),
    },
  });
}
