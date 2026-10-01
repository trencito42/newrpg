import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";
import crypto from "crypto";

interface Context {
  params: Promise<{ type: string; id: string }>;
}

const resignationActionSchema = z.object({
  resignationId: z.number().int().positive().optional(),
  action: z.enum(["submit", "accept", "accept_fp", "decline"]),
  reason: z.string().trim().max(255).optional(),
  fp: z.number().int().min(0).max(50).optional(),
});

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId } = await params;
  if (type !== "faction") {
    return NextResponse.json({ error: "not_supported" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let canManage = session.adminLevel >= 3;
  if (!canManage) {
    const leaderRow = await dbQuerySingle<RowDataPacket>(
      `SELECT c.job, c.job_grade, fl.id as is_leader
       FROM characters c
       JOIN players p ON p.id = c.player_id
       LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
       WHERE p.account_id = ? AND c.job = ? LIMIT 1`,
      [orgId, session.accountId, orgId]
    );
    if (leaderRow && (Number(leaderRow.job_grade) >= 6 || Boolean(leaderRow.is_leader))) {
      canManage = true;
    }
  }

  if (canManage) {
    const requests = await dbQuery<RowDataPacket>(
      `SELECT 
        fr.id, fr.faction_id, fr.character_id, fr.reason, fr.status,
        fr.created_at, fr.handled_at,
        acc.username as member_username,
        c.job_grade as rank,
        c.level,
        handler.username as handled_by_username
       FROM faction_resignations fr
       JOIN characters c ON c.id = fr.character_id
       JOIN players p ON p.id = c.player_id
       JOIN accounts acc ON acc.id = p.account_id
       LEFT JOIN characters hc ON hc.id = fr.handled_by_character_id
       LEFT JOIN players hp ON hp.id = hc.player_id
       LEFT JOIN accounts handler ON handler.id = hp.account_id
       WHERE fr.faction_id = ?
       ORDER BY FIELD(fr.status, 'pending', 'accepted', 'accepted_fp', 'declined', 'expired'), fr.created_at DESC`,
      [orgId]
    );
    return NextResponse.json({ canManage: true, requests });
  }

  // Member sees their own resignation requests
  const myRequests = await dbQuery<RowDataPacket>(
    `SELECT 
      fr.id, fr.faction_id, fr.character_id, fr.reason, fr.status,
      fr.created_at, fr.handled_at
     FROM faction_resignations fr
     JOIN characters c ON c.id = fr.character_id
     JOIN players p ON p.id = c.player_id
     WHERE fr.faction_id = ? AND p.account_id = ?
     ORDER BY fr.created_at DESC`,
    [orgId, session.accountId]
  );

  return NextResponse.json({ canManage: false, requests: myRequests });
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { type, id: orgId } = await params;
  if (type !== "faction") {
    return NextResponse.json({ error: "not_supported" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session || !session.selectedCharacterId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = resignationActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const { resignationId, action, reason, fp = 10 } = parsed.data;

  // 1. Submit a resignation request
  if (action === "submit") {
    const char = await dbQuerySingle<RowDataPacket>(
      `SELECT c.id, c.job, c.job_grade
       FROM characters c
       JOIN players p ON p.id = c.player_id
       WHERE c.id = ? AND p.account_id = ? LIMIT 1`,
      [session.selectedCharacterId, session.accountId]
    );

    if (!char || char.job !== orgId) {
      return NextResponse.json({ error: "not_in_faction" }, { status: 400 });
    }

    const existingPending = await dbQuerySingle<RowDataPacket>(
      `SELECT id FROM faction_resignations WHERE faction_id = ? AND character_id = ? AND status = 'pending' LIMIT 1`,
      [orgId, char.id]
    );
    if (existingPending) {
      return NextResponse.json({ error: "pending_resignation_exists" }, { status: 400 });
    }

    const ins = await dbQuerySingle<{ insertId: number }>(
      `INSERT INTO faction_resignations (faction_id, character_id, reason, status)
       VALUES (?, ?, ?, 'pending')`,
      [orgId, char.id, reason || "Faction resignation request"]
    );

    return NextResponse.json({ success: true, id: ins?.insertId });
  }

  // 2. Handle a resignation request (accept, accept_fp, decline)
  let canManage = session.adminLevel >= 3;
  if (!canManage) {
    const leaderRow = await dbQuerySingle<RowDataPacket>(
      `SELECT c.job, c.job_grade, fl.id as is_leader
       FROM characters c
       JOIN players p ON p.id = c.player_id
       LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
       WHERE p.account_id = ? AND c.job = ? LIMIT 1`,
      [orgId, session.accountId, orgId]
    );
    if (leaderRow && (Number(leaderRow.job_grade) >= 6 || Boolean(leaderRow.is_leader))) {
      canManage = true;
    }
  }

  if (!canManage) {
    return NextResponse.json({ error: "forbidden_leader_only" }, { status: 403 });
  }

  if (!resignationId) {
    return NextResponse.json({ error: "resignation_id_required" }, { status: 400 });
  }

  const reqRow = await dbQuerySingle<RowDataPacket>(
    `SELECT fr.*, p.account_id
     FROM faction_resignations fr
     JOIN characters c ON c.id = fr.character_id
     JOIN players p ON p.id = c.player_id
     WHERE fr.id = ? AND fr.faction_id = ? LIMIT 1`,
    [resignationId, orgId]
  );

  if (!reqRow || reqRow.status !== "pending") {
    return NextResponse.json({ error: "request_not_pending" }, { status: 400 });
  }

  await dbTransaction(async (conn) => {
    const statusVal = action === "accept" ? "accepted" : (action === "accept_fp" ? "accepted_fp" : "declined");
    await conn.execute(
      `UPDATE faction_resignations 
       SET status = ?, handled_by_character_id = ?, handled_at = NOW()
       WHERE id = ?`,
      [statusVal, session.selectedCharacterId, resignationId]
    );

    const orgLabel = type === "faction" ? `Faction ${orgId}` : `Clan ${orgId}`;
    const resTitleEn = `Resignation ${statusVal.toUpperCase()}`;
    const resTitleRo = `Demisie ${statusVal === "accepted" ? "ACCEPTATĂ" : (statusVal === "accepted_fp" ? "ACCEPTATĂ CU FP" : "RESPINSĂ")}`;
    const resMsgEn = `Your resignation request for ${orgLabel} has been ${statusVal.replace(/_/g, " ")}. ${reason ? `Note: ${reason}` : ""}`;
    const resMsgRo = `Cererea ta de demisie din ${orgLabel} a fost ${statusVal === "accepted" ? "acceptată" : (statusVal === "accepted_fp" ? "acceptată cu FP" : "respinsă")}. ${reason ? `Notă: ${reason}` : ""}`;

    await conn.execute(
      `INSERT INTO panel_notifications (account_id, type, title_en, title_ro, message_en, message_ro, link_url)
       VALUES (?, 'resignation_decision', ?, ?, ?, ?, ?)`,
      [reqRow.account_id, resTitleEn, resTitleRo, resMsgEn, resMsgRo, `/${type === "faction" ? "factions" : "clans"}/${orgId}`]
    );

    if (action === "accept" || action === "accept_fp") {
      // Queue the kick / kick_fp action to domain
      const requestId = crypto.randomUUID();
      const queueAction = action === "accept_fp" ? "faction_kick_fp" : "faction_kick";
      const payload = JSON.stringify({
        factionId: orgId,
        fp: action === "accept_fp" ? fp : 0,
      });

      await conn.execute(
        `INSERT INTO panel_action_queue
          (request_id, actor_account_id, actor_character_id, action, target_account_id, target_character_id, payload_json, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
          session.accountId,
          session.selectedCharacterId,
          queueAction,
          reqRow.account_id,
          reqRow.character_id,
          payload,
          `Resignation #${resignationId} ${statusVal}: ${reason || "Processed by leadership"}`,
        ]
      );
    }
  });

  return NextResponse.json({ success: true, action });
}
