import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface SubRow extends RowDataPacket { id: number }

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
    const existing = await dbQuerySingle<SubRow>(
      `SELECT id FROM panel_forum_subscriptions WHERE account_id = ? AND topic_id = ?`,
      [session.accountId, topicId]
    );

    if (existing) {
      await dbExecute(
        `DELETE FROM panel_forum_subscriptions WHERE account_id = ? AND topic_id = ?`,
        [session.accountId, topicId]
      );
      return NextResponse.json({ subscribed: false });
    } else {
      await dbExecute(
        `INSERT IGNORE INTO panel_forum_subscriptions (account_id, topic_id) VALUES (?, ?)`,
        [session.accountId, topicId]
      );
      return NextResponse.json({ subscribed: true });
    }
  } catch (err) {
    console.error("[forum/topics/[id]/subscribe] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
