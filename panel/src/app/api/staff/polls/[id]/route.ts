import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pollId = Number(id);

  try {
    const body = await req.json();
    const status = body.status; // 'active', 'closed', 'archived'

    if (!["active", "closed", "archived"].includes(status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }

    await dbExecute("UPDATE panel_polls SET status = ? WHERE id = ?", [status, pollId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pollId = Number(id);

  try {
    await dbTransaction(async (conn) => {
      await conn.execute("DELETE FROM panel_poll_votes WHERE poll_id = ?", [pollId]);
      await conn.execute("DELETE FROM panel_poll_options WHERE poll_id = ?", [pollId]);
      await conn.execute("DELETE FROM panel_polls WHERE id = ?", [pollId]);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}
