import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const clanId = Number(idStr);
  if (!Number.isSafeInteger(clanId) || clanId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const clan = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      c.id, c.name, c.tag, c.description, c.tag_color, c.tag_style,
      c.owner_character_id, c.motd, c.max_members, c.created_at, c.rank_labels,
      acc.username as owner_username,
      (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) as member_count,
      (SELECT COUNT(*) FROM turfs t WHERE t.owner_clan_id = c.id) as turfs_count,
      COALESCE(s.applications_open, 0) as applications_open,
      s.min_level, s.min_hours, s.max_warnings
     FROM clans c
     JOIN characters ch ON ch.id = c.owner_character_id
     JOIN players p ON p.id = ch.player_id
     JOIN accounts acc ON acc.id = p.account_id
     LEFT JOIN panel_org_application_settings s ON s.org_type = 'clan' AND s.org_id = CONVERT(c.id, CHAR) COLLATE utf8mb4_unicode_ci
     WHERE c.id = ? LIMIT 1`,
    [clanId]
  );

  if (!clan) {
    return NextResponse.json({ error: "clan_not_found" }, { status: 404 });
  }

  // Fetch members
  const members = await dbQuery<RowDataPacket>(
    `SELECT 
      c.id as character_id,
      a.id as account_id,
      a.username,
      cm.rank,
      cm.warns,
      cm.joined_at,
      c.level,
      ${factionIdSql()} as faction_id,
      ${factionGradeSql()} as faction_rank,
      c.paydays_received as hours,
      c.last_played,
      (cl.owner_character_id = c.id) as is_owner,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style
     FROM clan_members cm
     JOIN characters c ON c.id = cm.character_id
     JOIN players p ON p.id = c.player_id
     JOIN accounts a ON a.id = p.account_id
     JOIN clans cl ON cl.id = cm.clan_id
     WHERE cm.clan_id = ?
     ORDER BY (cl.owner_character_id = c.id) DESC, cm.rank DESC, cm.joined_at ASC`,
    [clanId]
  );

  // Fetch controlled turfs
  const turfs = await dbQuery<RowDataPacket>(
    `SELECT id, name, radius, payout, respect_payout
     FROM turfs
     WHERE owner_clan_id = ?`,
    [clanId]
  );

  return NextResponse.json({ clan, members, turfs });
}
