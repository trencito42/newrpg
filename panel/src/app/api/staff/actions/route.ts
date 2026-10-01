import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";

const requestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum([
    "ban",
    "unban",
    "mute",
    "unmute",
    "warn",
    "jail",
    "unjail",
    "set_faction",
    "set_clan",
    "staff_set_admin",
    "staff_set_helper",
    "staff_remove_role",
    "faction_set_member",
    "faction_set_rank",
    "faction_warn",
    "faction_kick",
    "faction_kick_fp",
    "faction_pardon_fp",
    "faction_set_leader",
    "clan_add_member",
    "clan_set_rank",
    "clan_warn",
    "clan_kick",
    "clan_dissolve",
  ]),
  targetAccountId: z.number().int().positive().optional(),
  targetCharacterId: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(255),
  durationMin: z.number().int().min(1).max(43200).optional(),
  level: z.number().int().min(0).max(6).optional(),
  factionId: z.string().regex(/^[a-z0-9_]{2,32}$/).nullable().optional(),
  factionGrade: z.number().int().min(0).max(20).optional(),
  clanId: z.number().int().positive().optional(),
  rank: z.number().int().min(1).max(7).optional(),
  fp: z.number().int().min(0).max(100).optional(),
});

interface TargetAccountRow extends RowDataPacket {
  id: number;
  username: string;
  admin_level: number;
  helper_level: number;
}

interface ActionRow extends RowDataPacket {
  id: number;
  actor_account_id: number;
  status: string;
  result_json: unknown;
  error_message: string | null;
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const input = parsed.data;

  // 1. Authorize action based on session roles
  let isAuthorized = false;

  // Staff roles actions (Level 6 Admin only)
  if (
    input.action === "staff_set_admin" ||
    input.action === "staff_set_helper" ||
    input.action === "staff_remove_role"
  ) {
    if (session.adminLevel >= 6) isAuthorized = true;
  }
  // Moderation actions
  else if (input.action === "warn" || input.action === "mute" || input.action === "unmute") {
    if (session.adminLevel >= 1 || (session.helperLevel >= 1 && input.action.startsWith("mute"))) {
      isAuthorized = true;
    }
  } else if (input.action === "ban" || input.action === "jail" || input.action === "unjail") {
    if (session.adminLevel >= 2) isAuthorized = true;
  } else if (input.action === "unban" || input.action === "set_faction") {
    if (session.adminLevel >= 3) isAuthorized = true;
  } else if (input.action === "set_clan" || input.action === "faction_set_leader") {
    if (session.adminLevel >= 4) isAuthorized = true;
  } else if (input.action === "clan_dissolve") {
    if (session.adminLevel >= 5) isAuthorized = true;
  }
  // Faction member management
  else if (input.action.startsWith("faction_")) {
    if (session.adminLevel >= 3) {
      isAuthorized = true;
    } else if (input.factionId) {
      // Check if session user is leader or sub-leader
      const leaderRow = await dbQuerySingle<RowDataPacket>(
        `SELECT c.job, c.job_grade, fl.id as is_leader
         FROM characters c
         JOIN players p ON p.id = c.player_id
         LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
         WHERE p.account_id = ? AND c.job = ? LIMIT 1`,
        [input.factionId, session.accountId, input.factionId]
      );
      if (leaderRow) {
        const grade = Number(leaderRow.job_grade) || 0;
        const isLeader = Boolean(leaderRow.is_leader) || grade >= 7;
        const isSubLeader = grade >= 6;
        if (input.action === "faction_pardon_fp") {
          if (isLeader) isAuthorized = true;
        } else if (isLeader || isSubLeader) {
          isAuthorized = true;
        }
      }
    }
  }
  // Clan member management
  else if (input.action.startsWith("clan_")) {
    if (session.adminLevel >= 4) {
      isAuthorized = true;
    } else if (input.clanId) {
      const clanRow = await dbQuerySingle<RowDataPacket>(
        `SELECT cm.rank, c.owner_character_id, ch.id as char_id
         FROM clan_members cm
         JOIN characters ch ON ch.id = cm.character_id
         JOIN players p ON p.id = ch.player_id
         JOIN clans c ON c.id = cm.clan_id
         WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
        [session.accountId, input.clanId]
      );
      if (clanRow) {
        const rank = Number(clanRow.rank) || 1;
        const isOwner = Number(clanRow.owner_character_id) === Number(clanRow.char_id);
        if (input.action === "clan_add_member" || input.action === "clan_set_rank") {
          if (rank >= 6 || isOwner) isAuthorized = true;
        } else if (input.action === "clan_warn" || input.action === "clan_kick") {
          if (rank >= 5 || isOwner) isAuthorized = true;
        }
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Check idempotency via request_id
  const prior = await dbQuerySingle<ActionRow>(
    "SELECT id, actor_account_id, status, result_json, error_message FROM panel_action_queue WHERE request_id = ?",
    [input.requestId]
  );
  if (prior) {
    if (prior.actor_account_id !== session.accountId) {
      return NextResponse.json({ error: "request_conflict" }, { status: 409 });
    }
    return NextResponse.json({
      id: prior.id,
      status: prior.status,
      result: prior.result_json,
      error: prior.error_message,
    });
  }

  // Resolve target account ID if targetCharacterId provided
  let targetAccountId = input.targetAccountId;
  if (input.targetCharacterId && !targetAccountId) {
    const charOwner = await dbQuerySingle<RowDataPacket>(
      "SELECT p.account_id FROM characters c JOIN players p ON p.id = c.player_id WHERE c.id = ? LIMIT 1",
      [input.targetCharacterId]
    );
    if (!charOwner) {
      return NextResponse.json({ error: "target_character_not_found" }, { status: 404 });
    }
    targetAccountId = Number(charOwner.account_id);
  }

  // Target account verification & hierarchy guard
  if (targetAccountId) {
    if (targetAccountId === session.accountId && !input.action.includes("dissolve")) {
      return NextResponse.json({ error: "self_target" }, { status: 400 });
    }

    const targetAccount = await dbQuerySingle<TargetAccountRow>(
      "SELECT id, username, admin_level, helper_level FROM accounts WHERE id = ? LIMIT 1",
      [targetAccountId]
    );

    if (!targetAccount) {
      return NextResponse.json({ error: "target_account_not_found" }, { status: 404 });
    }

    // Protect equal/higher staff if moderation action
    if (
      session.adminLevel > 0 &&
      session.adminLevel < 6 &&
      targetAccount.admin_level >= session.adminLevel
    ) {
      return NextResponse.json({ error: "target_staff_level_protected" }, { status: 403 });
    }
  }

  const payload = JSON.stringify({
    durationMin: input.durationMin || null,
    level: input.level !== undefined ? input.level : null,
    factionId: input.factionId ?? null,
    factionGrade: input.factionGrade ?? null,
    clanId: input.clanId ?? null,
    rank: input.rank ?? null,
    fp: input.fp ?? null,
  });

  try {
    const id = await dbTransaction(async (conn) => {
      const [recent] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM panel_action_queue WHERE actor_account_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE",
        [session.accountId]
      );
      if (Number(recent[0]?.n) >= 20) throw new Error("rate_limited");

      const [insert] = await conn.execute<import("mysql2").ResultSetHeader>(
        `INSERT INTO panel_action_queue
          (request_id, actor_account_id, actor_character_id, action, target_account_id, target_character_id, payload_json, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.requestId,
          session.accountId,
          session.selectedCharacterId,
          input.action,
          targetAccountId || null,
          input.targetCharacterId || null,
          payload,
          input.reason,
        ]
      );

      await conn.execute(
        `INSERT INTO panel_audit_log (actor_account_id, actor_character_id, action, target_entity, target_id, reason, details)
         VALUES (?, ?, ?, 'account', ?, ?, ?)`,
        [
          session.accountId,
          session.selectedCharacterId,
          `queue_${input.action}`,
          targetAccountId || 0,
          input.reason,
          JSON.stringify({ requestId: input.requestId, queueId: insert.insertId }),
        ]
      );

      // Dispatch notification to target player if targetAccountId is present
      if (targetAccountId && targetAccountId !== session.accountId) {
        let titleEn = "Account Notification";
        let titleRo = "Notificare Cont";
        let msgEn = `A management action (${input.action}) was recorded: ${input.reason}`;
        let msgRo = `O acțiune (${input.action}) a fost înregistrată: ${input.reason}`;
        let linkUrl: string | null = null;

        if (input.action === "warn") {
          titleEn = "Warning Received";
          titleRo = "Avertisment Primit (Warn)";
          msgEn = `You received a warning. Reason: ${input.reason}`;
          msgRo = `Ai primit un avertisment (Warn). Motiv: ${input.reason}`;
        } else if (input.action === "mute") {
          titleEn = "Muted";
          titleRo = "Redus la tăcere (Mute)";
          msgEn = `You have been muted for ${input.durationMin || 10} minutes. Reason: ${input.reason}`;
          msgRo = `Ai primit mute pentru ${input.durationMin || 10} minute. Motiv: ${input.reason}`;
        } else if (input.action === "ban") {
          titleEn = "Account Suspended";
          titleRo = "Cont Suspendat (Ban)";
          msgEn = `Your account has been banned. Reason: ${input.reason}`;
          msgRo = `Contul tău a fost suspendat. Motiv: ${input.reason}`;
          linkUrl = "/support/unban";
        } else if (input.action === "unban") {
          titleEn = "Account Unbanned";
          titleRo = "Cont Debanat";
          msgEn = "Your account ban has been lifted.";
          msgRo = "Suspendarea contului tău a fost revocată.";
        } else if (input.action === "faction_set_rank" || input.action === "faction_set_member") {
          titleEn = "Faction Rank Updated";
          titleRo = "Grad Facțiune Modificat";
          msgEn = `Your faction rank in ${input.factionId || "faction"} was updated to Rank ${input.factionGrade || 1}. Reason: ${input.reason}`;
          msgRo = `Gradul tău în facțiunea ${input.factionId || "facțiune"} a fost setat la Rank ${input.factionGrade || 1}. Motiv: ${input.reason}`;
          linkUrl = input.factionId ? `/factions/${input.factionId}` : null;
        } else if (input.action === "faction_warn") {
          titleEn = "Faction Warning (FW)";
          titleRo = "Avertisment Facțiune (FW)";
          msgEn = `You received a Faction Warning (FW) in ${input.factionId || "faction"}. Reason: ${input.reason}`;
          msgRo = `Ai primit un Faction Warning (FW) în ${input.factionId || "facțiune"}. Motiv: ${input.reason}`;
          linkUrl = input.factionId ? `/factions/${input.factionId}` : null;
        } else if (input.action === "faction_kick" || input.action === "faction_kick_fp") {
          titleEn = "Dismissed from Faction";
          titleRo = "Demis din Facțiune";
          msgEn = `You were dismissed from ${input.factionId || "faction"}${input.fp ? ` with ${input.fp} FP` : ""}. Reason: ${input.reason}`;
          msgRo = `Ai fost demis din ${input.factionId || "facțiune"}${input.fp ? ` cu ${input.fp} FP` : ""}. Motiv: ${input.reason}`;
        } else if (input.action === "clan_set_rank" || input.action === "clan_add_member") {
          titleEn = "Clan Rank Updated";
          titleRo = "Grad Clan Modificat";
          msgEn = `Your clan rank was updated to Rank ${input.rank || 1}. Reason: ${input.reason}`;
          msgRo = `Gradul tău în clan a fost modificat la Rank ${input.rank || 1}. Motiv: ${input.reason}`;
          linkUrl = input.clanId ? `/clans/${input.clanId}` : null;
        } else if (input.action === "clan_warn") {
          titleEn = "Clan Warning (CW)";
          titleRo = "Avertisment Clan (CW)";
          msgEn = `You received a Clan Warning (CW). Reason: ${input.reason}`;
          msgRo = `Ai primit un Clan Warning (CW). Motiv: ${input.reason}`;
          linkUrl = input.clanId ? `/clans/${input.clanId}` : null;
        } else if (input.action === "clan_kick") {
          titleEn = "Dismissed from Clan";
          titleRo = "Demis din Clan";
          msgEn = `You were dismissed from the clan. Reason: ${input.reason}`;
          msgRo = `Ai fost demis din clan. Motiv: ${input.reason}`;
        } else if (input.action === "staff_set_admin" || input.action === "staff_set_helper") {
          titleEn = "Staff Role Updated";
          titleRo = "Rol Staff Modificat";
          msgEn = `Your staff rank was updated to Level ${input.level || 1}. Reason: ${input.reason}`;
          msgRo = `Rolul tău în echipa staff a fost actualizat la Level ${input.level || 1}. Motiv: ${input.reason}`;
          linkUrl = "/staff/dashboard";
        }

        await conn.execute(
          `INSERT INTO panel_notifications (account_id, type, title_en, title_ro, message_en, message_ro, link_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [targetAccountId, input.action, titleEn, titleRo, msgEn, msgRo, linkUrl]
        );
      }

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
        return NextResponse.json({
          id: existing.id,
          status: existing.status,
          result: existing.result_json,
          error: existing.error_message,
        });
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
