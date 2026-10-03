import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { getFactionAccess } from "@/lib/faction-access";

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
    "kick",
    "set_cash",
    "set_bank",
    "set_level",
    "set_hours",
    "set_fp",
    "set_premium_points",
    "set_email",
    "reset_password",
    "give_item",
    "remove_item",
    "clear_inventory",
    "remove_sanction",
    "set_faction",
    "set_clan",
    "staff_set_admin",
    "staff_set_helper",
    "staff_remove_role",
    "set_admin_level",
    "set_helper_level",
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
    "set_author",
    "add_badge",
    "remove_badge",
  ]),
  targetAccountId: z.number().int().positive().optional(),
  targetCharacterId: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(255),
  durationMin: z.number().int().min(1).max(43200).optional(),
  level: z.number().int().min(0).max(100).optional(),
  amount: z.number().int().min(0).max(2000000000).optional(),
  cash: z.number().int().min(0).max(2000000000).optional(),
  bank: z.number().int().min(0).max(2000000000).optional(),
  hours: z.number().int().min(0).max(100000).optional(),
  points: z.number().int().min(0).max(1000000).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(128).optional(),
  item: z.string().min(1).max(64).optional(),
  count: z.number().int().min(1).max(100000).optional(),
  sanctionId: z.number().int().positive().optional(),
  factionId: z.string().regex(/^[a-z0-9_]{2,32}$/).nullable().optional(),
  factionGrade: z.number().int().min(0).max(20).optional(),
  clanId: z.number().int().positive().optional(),
  rank: z.number().int().min(1).max(7).optional(),
  fp: z.number().int().min(0).max(100).optional(),
  isAuthor: z.boolean().optional(),
  badgeKey: z.string().trim().min(1).max(64).optional(),
  badgeTitle: z.string().trim().min(1).max(64).optional(),
  badgeDescription: z.string().trim().max(255).optional(),
  badgeIcon: z.string().trim().max(64).optional(),
  badgeColor: z.string().trim().max(32).optional(),
  badgeBgColor: z.string().trim().max(32).optional(),
  badgeId: z.number().int().positive().optional(),
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
    input.action === "staff_remove_role" ||
    input.action === "set_admin_level" ||
    input.action === "set_helper_level"
  ) {
    if (session.adminLevel >= 6) isAuthorized = true;
  }
  // Moderation actions
  else if (input.action === "warn" || input.action === "mute" || input.action === "unmute") {
    if (session.adminLevel >= 1 || (session.helperLevel >= 1 && input.action.startsWith("mute"))) {
      isAuthorized = true;
    }
  } else if (
    input.action === "unban" ||
    input.action === "set_faction" ||
    input.action === "set_author" ||
    input.action === "add_badge" ||
    input.action === "remove_badge"
  ) {
    if (session.adminLevel >= 3) isAuthorized = true;
  } else if (
    input.action === "set_clan" ||
    input.action === "faction_set_leader" ||
    input.action === "set_cash" ||
    input.action === "set_bank" ||
    input.action === "set_level" ||
    input.action === "set_hours" ||
    input.action === "set_fp" ||
    input.action === "give_item" ||
    input.action === "remove_item" ||
    input.action === "clear_inventory"
  ) {
    if (session.adminLevel >= 4) isAuthorized = true;
  } else if (
    input.action === "clan_dissolve" ||
    input.action === "set_premium_points" ||
    input.action === "set_email" ||
    input.action === "reset_password" ||
    input.action === "remove_sanction"
  ) {
    if (session.adminLevel >= 5) isAuthorized = true;
  }
  // Faction member management
  else if (input.action.startsWith("faction_")) {
    if (session.adminLevel >= 3) {
      isAuthorized = true;
    } else if (input.factionId) {
      const leaderRow = await getFactionAccess(session.accountId, input.factionId);
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
    const isPunitive = ["warn", "ban", "mute", "kick", "jail"].includes(input.action);
    if (targetAccountId === session.accountId && isPunitive && session.adminLevel < 6) {
      return NextResponse.json({ error: "self_target" }, { status: 400 });
    }

    const targetAccount = await dbQuerySingle<TargetAccountRow>(
      "SELECT id, username, admin_level, helper_level FROM accounts WHERE id = ? LIMIT 1",
      [targetAccountId]
    );

    if (!targetAccount) {
      return NextResponse.json({ error: "target_account_not_found" }, { status: 404 });
    }

    // Protect equal/higher staff if punitive moderation action
    if (
      isPunitive &&
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
    amount: input.amount ?? input.cash ?? input.bank ?? null,
    cash: input.cash ?? null,
    bank: input.bank ?? null,
    hours: input.hours ?? null,
    points: input.points ?? null,
    email: input.email ?? null,
    password: input.password ?? null,
    item: input.item ?? null,
    count: input.count ?? null,
    sanctionId: input.sanctionId ?? null,
    factionId: input.factionId ?? null,
    factionGrade: input.factionGrade ?? null,
    clanId: input.clanId ?? null,
    rank: input.rank ?? null,
    fp: input.fp ?? null,
    isAuthor: input.isAuthor ?? null,
    badgeKey: input.badgeKey ?? null,
    badgeTitle: input.badgeTitle ?? null,
    badgeDescription: input.badgeDescription ?? null,
    badgeIcon: input.badgeIcon ?? null,
    badgeColor: input.badgeColor ?? null,
    badgeBgColor: input.badgeBgColor ?? null,
    badgeId: input.badgeId ?? null,
  });

  try {
    const id = await dbTransaction(async (conn) => {
      const [recent] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM panel_action_queue WHERE actor_account_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE",
        [session.accountId]
      );
      if (Number(recent[0]?.n) >= 30) throw new Error("rate_limited");

      // Direct actions execution in DB
      if (input.action === "set_author" && targetAccountId) {
        const isAuthorVal = input.isAuthor ? 1 : 0;
        await conn.execute("UPDATE accounts SET is_author = ? WHERE id = ?", [isAuthorVal, targetAccountId]);
      } else if (input.action === "add_badge" && targetAccountId) {
        const title = input.badgeTitle || "Badge";
        const badgeKey = input.badgeKey || title.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const description = input.badgeDescription || null;
        const icon = input.badgeIcon || "fa-award";
        const color = input.badgeColor || "#F59E0B";
        const bgColor = input.badgeBgColor || `${color}20`;
        const assignedBy = session.username || "Staff";

        await conn.execute(
          `INSERT INTO account_badges (account_id, badge_key, title, description, icon, color, bg_color, assigned_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), icon = VALUES(icon), color = VALUES(color), bg_color = VALUES(bg_color), assigned_by = VALUES(assigned_by)`,
          [targetAccountId, badgeKey, title, description, icon, color, bgColor, assignedBy]
        );
      } else if (input.action === "remove_badge") {
        if (input.badgeId) {
          await conn.execute("DELETE FROM account_badges WHERE id = ?", [input.badgeId]);
        } else if (targetAccountId && input.badgeKey) {
          await conn.execute("DELETE FROM account_badges WHERE account_id = ? AND badge_key = ?", [targetAccountId, input.badgeKey]);
        }
      } else if (input.action === "staff_set_admin" || input.action === "set_admin_level") {
        if (targetAccountId && input.level !== undefined) {
          await conn.execute("UPDATE accounts SET admin_level = ? WHERE id = ?", [input.level, targetAccountId]);
        }
      } else if (input.action === "staff_set_helper" || input.action === "set_helper_level") {
        if (targetAccountId && input.level !== undefined) {
          await conn.execute("UPDATE accounts SET helper_level = ? WHERE id = ?", [input.level, targetAccountId]);
        }
      } else if (input.action === "staff_remove_role" && targetAccountId) {
        await conn.execute("UPDATE accounts SET admin_level = 0, helper_level = 0 WHERE id = ?", [targetAccountId]);
      } else if (input.action === "set_premium_points" && targetAccountId && input.points !== undefined) {
        await conn.execute("UPDATE accounts SET premium_points = ? WHERE id = ?", [input.points, targetAccountId]);
      } else if (input.action === "set_email" && targetAccountId && input.email) {
        await conn.execute("UPDATE accounts SET email = ? WHERE id = ?", [input.email, targetAccountId]);
      } else if (input.action === "remove_sanction" && input.sanctionId) {
        await conn.execute("DELETE FROM admin_sanctions WHERE id = ?", [input.sanctionId]);
      } else if (input.action === "set_cash" && input.cash !== undefined) {
        if (input.targetCharacterId) {
          await conn.execute("UPDATE characters SET cash = ? WHERE id = ?", [input.cash, input.targetCharacterId]);
        }
      } else if (input.action === "set_bank" && input.bank !== undefined) {
        if (input.targetCharacterId) {
          await conn.execute("UPDATE characters SET bank = ? WHERE id = ?", [input.bank, input.targetCharacterId]);
        }
      } else if (input.action === "set_level" && input.level !== undefined) {
        if (input.targetCharacterId) {
          await conn.execute("UPDATE characters SET level = ? WHERE id = ?", [input.level, input.targetCharacterId]);
        }
      } else if (input.action === "set_hours" && input.hours !== undefined) {
        if (input.targetCharacterId) {
          await conn.execute("UPDATE characters SET paydays_received = ? WHERE id = ?", [input.hours, input.targetCharacterId]);
        }
      }

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
          JSON.stringify({ requestId: input.requestId, queueId: insert.insertId, payload: JSON.parse(payload) }),
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
        } else if (input.action === "kick") {
          titleEn = "Kicked from Server";
          titleRo = "Deconectat de pe Server (Kick)";
          msgEn = `You were kicked from the server. Reason: ${input.reason}`;
          msgRo = `Ai primit kick de pe server. Motiv: ${input.reason}`;
        } else if (input.action === "unban") {
          titleEn = "Account Unbanned";
          titleRo = "Cont Debanat";
          msgEn = "Your account ban has been lifted.";
          msgRo = "Suspendarea contului tău a fost revocată.";
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
