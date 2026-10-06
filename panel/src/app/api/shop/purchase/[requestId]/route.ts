import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle } from "@/lib/db";
import { getAccountRacketCoins } from "@/lib/shop/panel-state";
import type { RowDataPacket } from "mysql2";

type QueueRow = RowDataPacket & {
  status: string;
  result_json: unknown;
  error_message: string | null;
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { requestId } = await ctx.params;
  const row = await dbQuerySingle<QueueRow>(
    `SELECT status, result_json, error_message FROM panel_action_queue
     WHERE request_id = ? AND actor_account_id = ? LIMIT 1`,
    [requestId, session.accountId]
  );
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const balance =
    row.status === "completed" ? await getAccountRacketCoins(session.accountId) : undefined;

  return NextResponse.json({
    requestId,
    status: row.status,
    result: row.result_json,
    error: row.error_message,
    balance,
  });
}
