import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

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
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  try {
    interface LogRow extends RowDataPacket {
      id: number;
      actor_account_id: number;
      actor_username: string;
      action: string;
      target_type: string;
      target_id: number;
      reason: string | null;
      metadata: string | null;
      created_at: string;
    }

    const logs = await dbQuery<LogRow>(
      `SELECT id, actor_account_id, actor_username, action, target_type, target_id, reason, metadata, created_at
       FROM panel_forum_modlog
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [PAGE_SIZE, offset]
    );

    interface CountRow extends RowDataPacket { total: number }
    const countRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS total FROM panel_forum_modlog`
    );

    return NextResponse.json({
      logs: logs.map((l) => ({
        ...l,
        metadata: l.metadata ? JSON.parse(l.metadata) : null,
      })),
      total: countRow?.total ?? 0,
      page,
      totalPages: Math.max(1, Math.ceil((countRow?.total ?? 0) / PAGE_SIZE)),
    });
  } catch (err) {
    console.error("[forum/mod/modlog] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
