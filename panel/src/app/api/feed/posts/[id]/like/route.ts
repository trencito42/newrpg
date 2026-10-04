import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  let action: "liked" | "unliked";

  const { action: reqAction } = await req.json().catch(() => ({}));

  if (reqAction === "unlike") {
    await dbExecute(
      "DELETE FROM social_post_likes WHERE post_id = ? AND character_id = ?",
      [postId, charId]
    );
    action = "unliked";
  } else {
    await dbExecute(
      "INSERT IGNORE INTO social_post_likes (post_id, character_id) VALUES (?, ?)",
      [postId, charId]
    );
    action = "liked";
  }

  interface CountRow extends RowDataPacket { cnt: number; }
  const lk = await dbQuerySingle<CountRow>("SELECT COUNT(*) AS cnt FROM social_post_likes WHERE post_id = ?", [postId]);
  const likesCount = lk ? Number(lk.cnt) : 0;

  return NextResponse.json({ ok: true, action, likesCount, likedByViewer: action === "liked" });
}
