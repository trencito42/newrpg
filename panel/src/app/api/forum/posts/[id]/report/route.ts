import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { getForumPermissions } from "@/lib/forum-permissions";
import type { Forum } from "@/lib/forum-types";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface PostRow extends RowDataPacket {
  id: number;
  topic_id: number;
  forum_id: number;
  deleted_at: string | null;
}

interface CountRow extends RowDataPacket {
  cnt: number;
}

const ReportSchema = z.object({
  reason: z.enum(["spam", "off_topic", "harassment", "advertising", "rule_violation", "other"]),
  details: z.string().max(500).optional(),
});

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const post = await dbQuerySingle<PostRow>(
      `SELECT id, topic_id, forum_id, deleted_at FROM panel_forum_posts WHERE id = ? LIMIT 1`,
      [postId]
    );

    if (!post || post.deleted_at) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const forum = await dbQuerySingle<RowDataPacket & Forum>("SELECT * FROM panel_forums WHERE id = ? LIMIT 1", [post.forum_id]);
    if (!forum || !(await getForumPermissions(session, forum)).canView) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Prevent duplicate reports for the same post from the same user
    const dupRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS cnt FROM panel_forum_reports
       WHERE reporter_account_id = ? AND post_id = ? AND status = 'open'`,
      [session.accountId, postId]
    );
    if ((dupRow?.cnt ?? 0) > 0) {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }

    // Rate limit: max 5 reports per hour per account
    const rateRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS cnt FROM panel_forum_reports
       WHERE reporter_account_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [session.accountId]
    );
    if ((rateRow?.cnt ?? 0) >= 5) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    await dbExecute(
      `INSERT INTO panel_forum_reports
         (reporter_account_id, reporter_username, topic_id, post_id, reason, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.accountId,
        session.username,
        post.topic_id,
        postId,
        parsed.data.reason,
        parsed.data.details ?? null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/posts/[id]/report] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
