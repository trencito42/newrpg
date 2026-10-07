import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { getFactionAccess } from "@/lib/faction-access";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import {
  FACTION_LOG_PAGE_SIZES,
  type FactionLogCategory,
  normalizeFactionEventType,
  sqlCategoryFilter,
} from "@/lib/faction-logs";

interface Context {
  params: Promise<{ type: string; id: string }>;
}

function parseCategory(raw: string | null): FactionLogCategory {
  if (
    raw === "members" ||
    raw === "ranks" ||
    raw === "warnings" ||
    raw === "leadership" ||
    raw === "applications"
  ) {
    return raw;
  }
  return "all";
}

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId } = await params;
  if (type !== "faction") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }
  if (!CANONICAL_FACTIONS[orgId]) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let canView = session.adminLevel >= 3;
  if (!canView) {
    const access = await getFactionAccess(session.accountId, orgId);
    canView = Boolean(access);
  }
  if (!canView) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = req.nextUrl.searchParams;
  const page = Math.max(1, Number(url.get("page") || 1));
  const limitRaw = Number(url.get("limit") || 25);
  const limit = (FACTION_LOG_PAGE_SIZES as readonly number[]).includes(limitRaw) ? limitRaw : 25;
  const offset = (page - 1) * limit;
  const category = parseCategory(url.get("category"));
  const search = (url.get("search") || "").trim().slice(0, 64);
  const targetCharacterId = Number(url.get("targetCharacterId") || 0);
  const fromDate = (url.get("from") || "").trim();
  const toDate = (url.get("to") || "").trim();

  const { clause: categoryClause, params: categoryParams } = sqlCategoryFilter(category);

  const conditions = ["fl.faction_id = ?"];
  const sqlParams: (string | number)[] = [orgId];

  if (targetCharacterId > 0) {
    conditions.push("(fl.target_character_id = ? OR fl.actor_character_id = ?)");
    sqlParams.push(targetCharacterId, targetCharacterId);
  }

  if (search) {
    conditions.push(
      `(fl.actor_name_snapshot LIKE ? OR fl.target_name_snapshot LIKE ? OR COALESCE(a_actor.username, '') LIKE ? OR COALESCE(a_target.username, '') LIKE ?)`
    );
    const like = `%${search}%`;
    sqlParams.push(like, like, like, like);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    conditions.push("fl.created_at >= ?");
    sqlParams.push(`${fromDate} 00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    conditions.push("fl.created_at <= ?");
    sqlParams.push(`${toDate} 23:59:59`);
  }

  const whereSql = conditions.join(" AND ") + categoryClause;
  const countParams = [...sqlParams, ...categoryParams];

  const totalRow = await dbQuerySingle<{ total: number } & RowDataPacket>(
    `SELECT COUNT(*) AS total
     FROM faction_logs fl
     LEFT JOIN characters c_actor ON c_actor.id = fl.actor_character_id
     LEFT JOIN players p_actor ON p_actor.id = c_actor.player_id
     LEFT JOIN accounts a_actor ON a_actor.id = p_actor.account_id
     LEFT JOIN characters c_target ON c_target.id = fl.target_character_id
     LEFT JOIN players p_target ON p_target.id = c_target.player_id
     LEFT JOIN accounts a_target ON a_target.id = p_target.account_id
     WHERE ${whereSql}`,
    countParams
  );

  const rows = await dbQuery<RowDataPacket>(
    `SELECT
       fl.id,
       fl.event_type,
       fl.actor_character_id,
       fl.target_character_id,
       fl.actor_name_snapshot,
       fl.target_name_snapshot,
       fl.previous_value,
       fl.new_value,
       fl.reason,
       fl.metadata,
       fl.created_at,
       a_actor.username AS actor_username,
       a_target.username AS target_username
     FROM faction_logs fl
     LEFT JOIN characters c_actor ON c_actor.id = fl.actor_character_id
     LEFT JOIN players p_actor ON p_actor.id = c_actor.player_id
     LEFT JOIN accounts a_actor ON a_actor.id = p_actor.account_id
     LEFT JOIN characters c_target ON c_target.id = fl.target_character_id
     LEFT JOIN players p_target ON p_target.id = c_target.player_id
     LEFT JOIN accounts a_target ON a_target.id = p_target.account_id
     WHERE ${whereSql}
     ORDER BY fl.created_at DESC, fl.id DESC
     LIMIT ? OFFSET ?`,
    [...countParams, limit, offset]
  );

  const items = rows.map((row) => ({
    id: row.id,
    eventType: normalizeFactionEventType(String(row.event_type)),
    actorCharacterId: row.actor_character_id,
    targetCharacterId: row.target_character_id,
    actorUsername: row.actor_username || row.actor_name_snapshot || null,
    targetUsername: row.target_username || row.target_name_snapshot || null,
    previousValue: row.previous_value,
    newValue: row.new_value,
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));

  const total = totalRow?.total ?? 0;

  return NextResponse.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
