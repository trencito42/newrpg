import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  
  let sql = `
    SELECT 
      c.id, c.name, c.tag, c.description, c.tag_color, c.tag_style,
      c.owner_character_id, c.max_members, c.created_at,
      acc.username as owner_username,
      (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) as member_count,
      (SELECT COUNT(*) FROM turfs t WHERE t.owner_clan_id = c.id) as turfs_count,
      COALESCE(s.applications_open, 0) as applications_open
    FROM clans c
    JOIN characters ch ON ch.id = c.owner_character_id
    JOIN players p ON p.id = ch.player_id
    JOIN accounts acc ON acc.id = p.account_id
    LEFT JOIN panel_org_application_settings s ON s.org_type = 'clan' AND s.org_id = CONVERT(c.id, CHAR) COLLATE utf8mb4_unicode_ci
  `;

  const params: unknown[] = [];
  if (search) {
    sql += ` WHERE c.name LIKE ? OR c.tag LIKE ? OR acc.username LIKE ?`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY turfs_count DESC, member_count DESC, c.id ASC LIMIT 100`;

  const clans = await dbQuery<RowDataPacket>(sql, params);
  return NextResponse.json({ clans });
}
