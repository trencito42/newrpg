import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import type { Forum } from "@/lib/forum-types";
import { getForumPermissions } from "@/lib/forum-permissions";

export const dynamic = "force-dynamic";

interface ReportRow extends RowDataPacket {
  id: number;
  status: string;
  forum_id: number;
}

const ResolveSchema = z.object({
  action: z.enum(["resolve", "dismiss"]),
  note: z.string().max(255).optional(),
});

export async function PATCH(
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

  const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
  if (!isMod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const reportId = parseInt(id, 10);
  if (!Number.isFinite(reportId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const report = await dbQuerySingle<ReportRow>(
      `SELECT r.id, r.status, t.forum_id FROM panel_forum_reports r
       JOIN panel_forum_topics t ON t.id = r.topic_id WHERE r.id = ? LIMIT 1`,
      [reportId]
    );

    if (!report) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const forum = await dbQuerySingle<RowDataPacket & Forum>("SELECT * FROM panel_forums WHERE id = ? LIMIT 1", [report.forum_id]);
    if (!forum || !(await getForumPermissions(session, forum)).canModerate) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (report.status !== "open") {
      return NextResponse.json({ error: "already_resolved" }, { status: 400 });
    }

    const newStatus = parsed.data.action === "resolve" ? "resolved" : "dismissed";

    await dbExecute(
      `UPDATE panel_forum_reports
       SET status = ?, resolved_by_account_id = ?, resolved_at = NOW(), resolution_note = ?
       WHERE id = ?`,
      [newStatus, session.accountId, parsed.data.note ?? null, reportId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/mod/reports/[id]] PATCH error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
