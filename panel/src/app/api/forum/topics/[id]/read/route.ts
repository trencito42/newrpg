import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface LastPostRow extends RowDataPacket { last_post_id: number | null }

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

  try {
    const topic = await dbQuerySingle<LastPostRow>(
      `SELECT last_post_id FROM panel_forum_topics WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [topicId]
    );

    if (!topic?.last_post_id) {
      return NextResponse.json({ success: true });
    }

    await dbExecute(
      `INSERT INTO panel_forum_topic_reads (account_id, topic_id, last_read_post_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_read_post_id = GREATEST(last_read_post_id, ?), read_at = NOW()`,
      [session.accountId, topicId, topic.last_post_id, topic.last_post_id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/topics/[id]/read] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
