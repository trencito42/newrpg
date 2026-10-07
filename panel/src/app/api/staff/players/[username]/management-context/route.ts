import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";
import type { RowDataPacket } from "mysql2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = await getCurrentSession();
  if (!session || (session.adminLevel < 1 && session.helperLevel < 1)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { username: raw } = await params;
  const username = decodeURIComponent(raw).replace(/_/g, " ");

  const player = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      a.id as account_id,
      a.username,
      a.email,
      a.premium_points,
      COALESCE(a.is_author, 0) as is_author,
      c.id as character_id,
      c.level,
      c.cash,
      c.bank,
      c.paydays_received as hours,
      c.last_played,
      c.metadata,
      ${factionIdSql()} as faction_id,
      ${factionGradeSql()} as faction_rank,
      cl.id as clan_id,
      cm.rank as clan_rank,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style,
      (p.last_seen > NOW() - INTERVAL 5 MINUTE) AS is_online
     FROM accounts a
     LEFT JOIN players p ON p.account_id = a.id
     LEFT JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     WHERE LOWER(a.username) = LOWER(?) LIMIT 1`,
    [username]
  );

  if (!player) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [sanctions, badges] = await Promise.all([
    dbQuery<RowDataPacket>(
      `SELECT id, action, target_name, admin_name, reason, duration_min, created_at
       FROM admin_sanctions
       WHERE target_account_id = ? OR LOWER(target_name) = LOWER(?)
       ORDER BY id DESC LIMIT 30`,
      [player.account_id, player.username]
    ),
    dbQuery<RowDataPacket>(
      "SELECT id, badge_key, title, description, icon, color, bg_color FROM account_badges WHERE account_id = ? ORDER BY id ASC",
      [player.account_id]
    ),
  ]);

  let avatar_skin: string | null = null;
  if (player.metadata) {
    try {
      const meta = typeof player.metadata === "string" ? JSON.parse(player.metadata) : player.metadata;
      if (meta?.skin) avatar_skin = String(meta.skin);
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    player: {
      account_id: player.account_id,
      character_id: player.character_id,
      username: player.username,
      email: player.email,
      level: player.level || 1,
      hours: player.hours || 0,
      cash: player.cash || 0,
      bank: player.bank || 0,
      premium_points: player.premium_points || 0,
      faction_id: player.faction_id,
      faction_rank: player.faction_rank,
      clan_id: player.clan_id,
      clan_rank: player.clan_rank,
      clan_tag: player.clan_tag,
      clan_tag_color: player.clan_tag_color,
      clan_tag_style: player.clan_tag_style,
      is_author: player.is_author,
      is_online: Boolean(player.is_online),
      last_played: player.last_played,
      avatar_skin,
    },
    sanctions,
    badges,
  });
}
