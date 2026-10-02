import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || (session.adminLevel < 1 && session.helperLevel < 1)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;

  let whereClause = "";
  const params: unknown[] = [];

  if (search) {
    whereClause = "WHERE a.username LIKE ?";
    params.push(`%${search}%`);
  }

  const sql = `
    SELECT 
      a.id as account_id,
      a.username,
      a.admin_level,
      a.helper_level,
      a.created_at,
      c.id as character_id,
      c.level,
      c.paydays_received as hours,
      ${factionIdSql()} as faction_id,
      ${factionGradeSql()} as faction_rank,
      c.last_played,
      cl.id as clan_id,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style,
      cm.rank as clan_rank,
      (SELECT COUNT(*) FROM admin_sanctions s WHERE s.target_account_id = a.id AND s.action = 'warn' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as active_warns,
      (SELECT COUNT(*) FROM bans b JOIN players pl ON pl.license = b.license WHERE pl.account_id = a.id AND (b.expires_at IS NULL OR b.expires_at > NOW())) as is_banned
    FROM accounts a
    LEFT JOIN players p ON p.account_id = a.id
    LEFT JOIN characters c ON c.player_id = p.id
    LEFT JOIN clan_members cm ON cm.character_id = c.id
    LEFT JOIN clans cl ON cl.id = cm.clan_id
    ${whereClause}
    ORDER BY a.admin_level DESC, a.helper_level DESC, c.level DESC, a.id ASC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);
  const players = await dbQuery<RowDataPacket>(sql, params);

  return NextResponse.json({ players, page, limit });
}
