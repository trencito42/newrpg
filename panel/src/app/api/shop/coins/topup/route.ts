import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle } from "@/lib/db";
import { getAccountRacketCoins } from "@/lib/shop/panel-state";
import type { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const row = await dbQuerySingle<
    RowDataPacket & {
      id: number;
      status: string;
      coins: number;
      package_id: string;
      account_id: number;
    }
  >(
    `SELECT id, status, coins, package_id, account_id FROM racket_coin_topups
     WHERE stripe_checkout_session_id = ? AND account_id = ? LIMIT 1`,
    [sessionId, session.accountId]
  );

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const balance = await getAccountRacketCoins(session.accountId);

  return NextResponse.json({
    topupId: row.id,
    status: row.status,
    coins: row.coins,
    packageId: row.package_id,
    fulfilled: row.status === "fulfilled",
    balance,
  });
}
