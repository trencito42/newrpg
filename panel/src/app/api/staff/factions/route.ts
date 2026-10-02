import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import { RowDataPacket } from "mysql2";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const factionList = Object.values(CANONICAL_FACTIONS).map((f) => f.id);
  const factionsData = [];

  for (const fId of factionList) {
    const config = CANONICAL_FACTIONS[fId];
    const leader = await dbQuery<RowDataPacket>(
      `SELECT c.id as character_id, a.id as account_id, a.username, ${factionGradeSql()} AS job_grade, fl.assigned_at,
              cl.tag AS clan_tag, cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style
       FROM characters c
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id = ?
       LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       WHERE ${factionIdSql()} = fm.faction_id AND (fl.id IS NOT NULL OR ${factionGradeSql()} >= 7)
       LIMIT 1`,
      [fId, fId]
    );

    const membersCount = await dbQuery<RowDataPacket>(
      `SELECT COUNT(*) as count FROM faction_membership fm JOIN characters c ON c.id = fm.character_id
       WHERE fm.faction_id = ? AND ${factionIdSql()} = fm.faction_id`,
      [fId]
    );

    const appsSettings = await dbQuery<RowDataPacket>(
      `SELECT applications_open, min_level, min_hours, max_warnings
       FROM panel_org_application_settings
       WHERE org_type = 'faction' AND org_id = ? LIMIT 1`,
      [fId]
    );

    const pendingApps = await dbQuery<RowDataPacket>(
      `SELECT COUNT(*) as count FROM panel_org_applications
       WHERE org_type = 'faction' AND org_id = ? AND status IN ('submitted', 'under_review')`,
      [fId]
    );

    const pendingResignations = await dbQuery<RowDataPacket>(
      `SELECT COUNT(*) as count FROM faction_resignations
       WHERE faction_id = ? AND status = 'pending'`,
      [fId]
    );

    factionsData.push({
      id: fId,
      label: config.label,
      type: config.type,
      factionType: config.factionType,
      color: config.color,
      leader: leader[0] || null,
      memberCount: Number(membersCount[0]?.count || 0),
      applicationsOpen: Boolean(appsSettings[0]?.applications_open),
      pendingApplications: Number(pendingApps[0]?.count || 0),
      pendingResignations: Number(pendingResignations[0]?.count || 0),
    });
  }

  return NextResponse.json({
    factions: factionsData,
    canAssignLeader: session.adminLevel >= 4,
  });
}
