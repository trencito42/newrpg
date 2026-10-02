import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";

interface Context {
  params: Promise<{ type: string; id: string }>;
}

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId } = await params;
  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }

  if (type === "faction") {
    const members = await dbQuery<RowDataPacket>(
      `SELECT 
        c.id as character_id,
        a.id as account_id,
        a.username,
        ${factionGradeSql()} as rank,
        c.level,
        c.paydays_received as hours,
        c.last_played,
        fl.id as is_leader,
        cl.tag as clan_tag,
        cl.tag_color as clan_tag_color,
        cl.tag_style as clan_tag_style,
        (SELECT COUNT(*) FROM faction_warnings fw WHERE fw.character_id = c.id AND fw.faction_id = ?) as faction_warns,
        (SELECT COALESCE(fp, 0) FROM faction_punish fp WHERE fp.character_id = c.id LIMIT 1) as faction_fp
       FROM characters c
       JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id = ?
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       WHERE ${factionIdSql()} = fm.faction_id
       ORDER BY (fl.id IS NOT NULL) DESC, rank DESC, c.level DESC`,
      [orgId, orgId, orgId]
    );

    return NextResponse.json({ members });
  } else {
    // Clan members
    const clanId = Number(orgId);
    const members = await dbQuery<RowDataPacket>(
      `SELECT 
        c.id as character_id,
        a.id as account_id,
        a.username,
        cm.rank,
        cm.warns as clan_warns,
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

    return NextResponse.json({ members });
  }
}
