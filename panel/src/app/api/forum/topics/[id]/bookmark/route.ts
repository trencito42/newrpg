import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { getForumPermissions } from "@/lib/forum-permissions";
import type { Forum } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface BookmarkRow extends RowDataPacket { id: number }

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
    const forum = await dbQuerySingle<RowDataPacket & Forum>(
      `SELECT f.* FROM panel_forums f JOIN panel_forum_topics t ON t.forum_id = f.id
       WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1`, [topicId]
    );
    if (!forum || !(await getForumPermissions(session, forum)).canView) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const existing = await dbQuerySingle<BookmarkRow>(
      `SELECT id FROM panel_forum_bookmarks WHERE account_id = ? AND topic_id = ?`,
      [session.accountId, topicId]
    );

    if (existing) {
      await dbExecute(
        `DELETE FROM panel_forum_bookmarks WHERE account_id = ? AND topic_id = ?`,
        [session.accountId, topicId]
      );
      return NextResponse.json({ bookmarked: false });
    } else {
      await dbExecute(
        `INSERT IGNORE INTO panel_forum_bookmarks (account_id, topic_id) VALUES (?, ?)`,
        [session.accountId, topicId]
      );
      return NextResponse.json({ bookmarked: true });
    }
  } catch (err) {
    console.error("[forum/topics/[id]/bookmark] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
