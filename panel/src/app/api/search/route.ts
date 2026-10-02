import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { factionIdSql } from "@/lib/faction-sql";

interface SearchRow extends RowDataPacket {
  id: number;
  username: string;
  level: number;
  job: string;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Parameterized search limiting output to 8 records to prevent enumeration
  const pattern = `%${q}%`;
  const rows = await dbQuery<SearchRow>(
    `SELECT c.id, a.username, c.level, ${factionIdSql()} AS job,
            cl.tag AS clan_tag, cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     WHERE a.username LIKE ?
     ORDER BY c.level DESC, c.last_played DESC
     LIMIT 8`,
    [pattern]
  );

  const results = rows.map((r) => ({
    id: r.id,
    slug: r.username,
    name: r.username,
    level: Number(r.level) || 1,
    job: r.job || "Unemployed",
    clanTag: r.clan_tag,
    clanColor: r.clan_tag_color,
    clanTagStyle: r.clan_tag_style,
  }));

  return NextResponse.json({ results });
}
