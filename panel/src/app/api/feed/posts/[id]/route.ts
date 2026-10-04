import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute, dbQuery } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const session = await getCurrentSession();
  const charId = session?.selectedCharacterId ?? 0;

  interface PostRow extends RowDataPacket {
    id: number; character_id: number; firstname: string; lastname: string;
    body: string | null; media_id: number | null; media_url: string | null;
    thumbnail_url: string | null; width: number | null; height: number | null;
    created_at: string; updated_at: string | null;
    likes_count: number; comments_count: number; liked_by_viewer: number;
  }

  const post = await dbQuerySingle<PostRow>(
    `SELECT p.id, p.character_id, c.firstname, c.lastname,
            p.body, p.media_id, pm.url AS media_url, pm.thumbnail_url, pm.width, pm.height,
            p.created_at, p.updated_at,
            COALESCE(lk.likes_count, 0) AS likes_count,
            COALESCE(cm.comments_count, 0) AS comments_count,
            CASE WHEN vl.post_id IS NOT NULL THEN 1 ELSE 0 END AS liked_by_viewer
     FROM social_posts p
     JOIN characters c ON c.id = p.character_id
     LEFT JOIN phone_media pm ON pm.id = p.media_id AND pm.deleted_at IS NULL
     LEFT JOIN (SELECT post_id, COUNT(*) AS likes_count FROM social_post_likes GROUP BY post_id) lk ON lk.post_id = p.id
     LEFT JOIN (SELECT post_id, COUNT(*) AS comments_count FROM social_comments WHERE deleted_at IS NULL GROUP BY post_id) cm ON cm.post_id = p.id
     LEFT JOIN social_post_likes vl ON vl.post_id = p.id AND vl.character_id = ?
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    [charId, postId]
  );

  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  interface CommentRow extends RowDataPacket {
    id: number; post_id: number; character_id: number; firstname: string; lastname: string;
    parent_comment_id: number | null; body: string; created_at: string; updated_at: string | null;
  }
  const comments = await dbQuery<CommentRow>(
    `SELECT c.id, c.post_id, c.character_id, ch.firstname, ch.lastname,
            c.parent_comment_id, c.body, c.created_at, c.updated_at
     FROM social_comments c
     JOIN characters ch ON ch.id = c.character_id
     WHERE c.post_id = ? AND c.deleted_at IS NULL
     ORDER BY c.id ASC
     LIMIT 100`,
    [postId]
  );

  return NextResponse.json({ post, comments });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const session = await getCurrentSession();
  if (!session?.selectedCharacterId) return NextResponse.json({ error: "no_character" }, { status: 401 });
  const charId = session.selectedCharacterId;

  const { id } = await params;
  const postId = parseInt(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  interface PostRow extends RowDataPacket { id: number; character_id: number; }
  const post = await dbQuerySingle<PostRow>(
    "SELECT id, character_id FROM social_posts WHERE id = ? AND deleted_at IS NULL",
    [postId]
  );
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (post.character_id !== charId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await dbExecute("UPDATE social_posts SET deleted_at = NOW() WHERE id = ?", [postId]);
  return NextResponse.json({ ok: true });
}
