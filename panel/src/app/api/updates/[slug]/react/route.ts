import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

interface ExistingReaction extends RowDataPacket {
  reaction: "like" | "dislike";
}

interface Counts extends RowDataPacket {
  likes_count: number;
  dislikes_count: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reaction = body?.reaction;
  if (reaction !== "like" && reaction !== "dislike") {
    return NextResponse.json({ error: "invalid_reaction" }, { status: 400 });
  }

  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).trim();

  const update = await dbQuerySingle<{ id: number } & RowDataPacket>(
    "SELECT id FROM panel_updates WHERE slug = ? LIMIT 1",
    [decodedSlug]
  );

  if (!update) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const existing = await dbQuerySingle<ExistingReaction>(
      `SELECT reaction FROM panel_update_reactions
       WHERE update_id = ? AND reactor_type = 'account' AND reactor_id = ?
       LIMIT 1`,
      [update.id, session.accountId]
    );

    if (existing?.reaction === reaction) {
      await dbExecute(
        `DELETE FROM panel_update_reactions
         WHERE update_id = ? AND reactor_type = 'account' AND reactor_id = ?`,
        [update.id, session.accountId]
      );
    } else {
      await dbExecute(
        `INSERT INTO panel_update_reactions (update_id, reactor_type, reactor_id, reaction)
         VALUES (?, 'account', ?, ?)
         ON DUPLICATE KEY UPDATE reaction = VALUES(reaction), updated_at = CURRENT_TIMESTAMP`,
        [update.id, session.accountId, reaction]
      );
    }

    const counts = await dbQuerySingle<Counts>(
      `SELECT
         COALESCE(SUM(reaction = 'like'),    0) AS likes_count,
         COALESCE(SUM(reaction = 'dislike'), 0) AS dislikes_count
       FROM panel_update_reactions
       WHERE update_id = ?`,
      [update.id]
    );

    return NextResponse.json({
      ok: true,
      my_reaction: existing?.reaction === reaction ? null : reaction,
      likes_count: Number(counts?.likes_count ?? 0),
      dislikes_count: Number(counts?.dislikes_count ?? 0),
    });
  } catch (err: any) {
    console.error("[updates/react POST]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
