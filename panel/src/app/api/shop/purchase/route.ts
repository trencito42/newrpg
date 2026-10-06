import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { shopProducts } from "@/generated/shop-catalog";
import type { RowDataPacket } from "mysql2";

const bodySchema = z.object({
  requestId: z.string().uuid(),
  productId: z.string().min(1).max(64),
  params: z
    .object({
      tag: z.string().max(16).optional(),
      color: z.string().max(16).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session?.selectedCharacterId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const product = shopProducts[parsed.data.productId];
  if (!product || product.enabled !== true) {
    return NextResponse.json({ error: "unknown_product" }, { status: 400 });
  }

  const requestId = parsed.data.requestId;
  const existing = await dbQuerySingle<RowDataPacket & { status: string; result_json: unknown }>(
    `SELECT status, result_json FROM panel_action_queue WHERE request_id = ? AND actor_account_id = ? LIMIT 1`,
    [requestId, session.accountId]
  );
  if (existing) {
    return NextResponse.json({
      requestId,
      status: existing.status,
      result: existing.result_json,
    });
  }

  const params = {
    tag: parsed.data.params?.tag,
    color: parsed.data.params?.color,
  };

  try {
    await dbTransaction(async (conn) => {
      const [recent] = await conn.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM panel_action_queue
         WHERE actor_account_id = ? AND action = 'shop_purchase' AND created_at > NOW() - INTERVAL 1 MINUTE`,
        [session.accountId]
      );
      if (Number(recent[0]?.n) > 20) {
        throw new Error("rate_limited");
      }

      await conn.execute(
        `INSERT INTO panel_action_queue
          (request_id, actor_account_id, actor_character_id, action, target_account_id, target_character_id, payload_json, reason)
         VALUES (?, ?, ?, 'shop_purchase', ?, ?, ?, ?)`,
        [
          requestId,
          session.accountId,
          session.selectedCharacterId,
          session.accountId,
          session.selectedCharacterId,
          JSON.stringify({ productId: parsed.data.productId, params }),
          "Racket Shop purchase",
        ]
      );
    });
  } catch (err) {
    if (String((err as Error)?.message) === "rate_limited") {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    throw err;
  }

  return NextResponse.json({ requestId, status: "pending" });
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
