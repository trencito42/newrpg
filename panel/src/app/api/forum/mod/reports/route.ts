import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { Forum } from "@/lib/forum-types";
import { getForumAccessMap } from "@/lib/forum-permissions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
  if (!isMod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const forums = await dbQuery<RowDataPacket & Forum>("SELECT * FROM panel_forums");
    const accessMap = await getForumAccessMap(session, forums);
    const moderatedIds = forums.filter((forum) => accessMap.get(Number(forum.id))?.canModerate).map((forum) => Number(forum.id));
    if (!moderatedIds.length) return NextResponse.json({ reports: [], total: 0, page, totalPages: 1 });
    const forumFilter = moderatedIds.map(() => "?").join(",");
    interface ReportRow extends RowDataPacket {
      id: number;
      reporter_account_id: number;
      reporter_username: string;
      topic_id: number;
      post_id: number | null;
      reason: string;
      details: string | null;
      status: string;
      resolved_by_account_id: number | null;
      resolved_at: string | null;
      resolution_note: string | null;
      created_at: string;
      topic_title: string;
      forum_name: string;
      post_excerpt: string | null;
      reported_username: string | null;
    }

    const reports = await dbQuery<ReportRow>(
      `SELECT r.*,
              t.title AS topic_title,
              f.name AS forum_name,
              SUBSTRING(p.content, 1, 300) AS post_excerpt,
              p.author_username AS reported_username
       FROM panel_forum_reports r
       JOIN panel_forum_topics t ON t.id = r.topic_id
       JOIN panel_forums f ON f.id = t.forum_id
       LEFT JOIN panel_forum_posts p ON p.id = r.post_id
       WHERE r.status = ? AND t.forum_id IN (${forumFilter})
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [status, ...moderatedIds, PAGE_SIZE, offset]
    );

    interface CountRow extends RowDataPacket { total: number }
    const countRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS total FROM panel_forum_reports r JOIN panel_forum_topics t ON t.id = r.topic_id
       WHERE r.status = ? AND t.forum_id IN (${forumFilter})`,
      [status, ...moderatedIds]
    );

    return NextResponse.json({
      reports,
      total: countRow?.total ?? 0,
      page,
      totalPages: Math.max(1, Math.ceil((countRow?.total ?? 0) / PAGE_SIZE)),
    });
  } catch (err) {
    console.error("[forum/mod/reports] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
