import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const notifications = await dbQuery<RowDataPacket>(
    `SELECT id, type, title_en, title_ro, message_en, message_ro, link_url, is_read, created_at
     FROM panel_notifications
     WHERE account_id = ?
     ORDER BY is_read ASC, created_at DESC
     LIMIT 30`,
    [session.accountId]
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: number; markAll?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.markAll) {
    await dbQuerySingle(
      `UPDATE panel_notifications SET is_read = 1 WHERE account_id = ? AND is_read = 0`,
      [session.accountId]
    );
  } else if (body.id) {
    await dbQuerySingle(
      `UPDATE panel_notifications SET is_read = 1 WHERE id = ? AND account_id = ?`,
      [body.id, session.accountId]
    );
  }

  return NextResponse.json({ success: true });
}
