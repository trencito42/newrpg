import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";

const requestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["ban", "unban", "mute", "warn", "set_faction"]),
  targetAccountId: z.number().int().positive().optional(),
  targetCharacterId: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(255),
  durationMin: z.number().int().min(1).max(43200).optional(),
  factionId: z.string().regex(/^[a-z0-9_]{2,32}$/).nullable().optional(),
  factionGrade: z.number().int().min(0).max(20).optional(),
});

const minimumAdminLevel = { ban: 2, unban: 3, mute: 1, warn: 1, set_faction: 3 } as const;

interface TargetRow extends RowDataPacket { account_id: number }
interface ActionRow extends RowDataPacket {
  id: number;
  actor_account_id: number;
  status: string;
  result_json: unknown;
  error_message: string | null;
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const input = parsed.data;
  if (session.adminLevel < minimumAdminLevel[input.action]) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const prior = await dbQuerySingle<ActionRow>(
    "SELECT id, actor_account_id, status, result_json, error_message FROM panel_action_queue WHERE request_id = ?",
    [input.requestId]
  );
  if (prior) {
    if (prior.actor_account_id !== session.accountId) return NextResponse.json({ error: "request_conflict" }, { status: 409 });
    return NextResponse.json({ id: prior.id, status: prior.status, result: prior.result_json, error: prior.error_message });
  }
  if (input.action === "set_faction" && (!input.targetCharacterId || input.factionId === undefined)) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  if (input.action === "mute" && !input.durationMin) {
    return NextResponse.json({ error: "duration_required" }, { status: 400 });
  }

  const character = input.targetCharacterId
    ? await dbQuerySingle<TargetRow>(
      "SELECT p.account_id FROM characters c JOIN players p ON p.id = c.player_id WHERE c.id = ? LIMIT 1",
      [input.targetCharacterId]
    ) : null;
  if (input.targetCharacterId && !character) return NextResponse.json({ error: "invalid_target" }, { status: 404 });
  const targetAccountId = character?.account_id || input.targetAccountId;
  if (!targetAccountId || (input.targetAccountId && input.targetAccountId !== targetAccountId)) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  if (targetAccountId === session.accountId) return NextResponse.json({ error: "self_target" }, { status: 400 });
  const account = await dbQuerySingle<RowDataPacket>("SELECT id FROM accounts WHERE id = ?", [targetAccountId]);
  if (!account) return NextResponse.json({ error: "invalid_target" }, { status: 404 });

  const payload = JSON.stringify({
    durationMin: input.durationMin || null,
    factionId: input.factionId ?? null,
    factionGrade: input.factionGrade ?? 0,
  });
  try {
    const id = await dbTransaction(async (conn) => {
      const [recent] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM panel_action_queue WHERE actor_account_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE",
        [session.accountId]
      );
      if (Number(recent[0]?.n) >= 10) throw new Error("rate_limited");
      const [insert] = await conn.execute<import("mysql2").ResultSetHeader>(
        `INSERT INTO panel_action_queue
          (request_id, actor_account_id, actor_character_id, action, target_account_id, target_character_id, payload_json, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.requestId, session.accountId, session.selectedCharacterId, input.action, targetAccountId, input.targetCharacterId || null, payload, input.reason]
      );
      await conn.execute(
        `INSERT INTO panel_audit_log (actor_account_id, actor_character_id, action, target_entity, target_id, reason, details)
         VALUES (?, ?, ?, 'account', ?, ?, ?)`,
        [session.accountId, session.selectedCharacterId, `queue_${input.action}`, targetAccountId, input.reason, JSON.stringify({ requestId: input.requestId, queueId: insert.insertId })]
      );
      return insert.insertId;
    });
    return NextResponse.json({ id, status: "pending" }, { status: 202 });
  } catch (error) {
    if ((error as { message?: string }).message === "rate_limited") {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      const existing = await dbQuerySingle<ActionRow>(
        "SELECT id, actor_account_id, status, result_json, error_message FROM panel_action_queue WHERE request_id = ?",
        [input.requestId]
      );
      if (existing?.actor_account_id === session.accountId) {
        return NextResponse.json({ id: existing.id, status: existing.status, result: existing.result_json, error: existing.error_message });
      }
      return NextResponse.json({ error: "request_conflict" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const row = await dbQuerySingle<ActionRow>(
    "SELECT id, actor_account_id, status, result_json, error_message FROM panel_action_queue WHERE id = ? AND actor_account_id = ?",
    [id, session.accountId]
  );
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ id: row.id, status: row.status, result: row.result_json, error: row.error_message });
}
