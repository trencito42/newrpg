import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { factionIdSql } from "@/lib/faction-sql";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || (session.adminLevel < 1 && session.helperLevel < 1)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const pattern = `%${q}%`;
  const rows = await dbQuery<RowDataPacket>(
    `SELECT 
       a.id AS account_id,
       a.username,
       c.id AS character_id,
       c.firstname,
       c.lastname,
       c.level,
       c.metadata,
       ${factionIdSql()} AS faction_id
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN characters c ON c.player_id = p.id
     WHERE a.username LIKE ? OR c.firstname LIKE ? OR c.lastname LIKE ?
     ORDER BY (a.username LIKE ?) DESC, c.level DESC
     LIMIT 10`,
    [pattern, pattern, pattern, `${q}%`]
  );

  const players = rows.map((r) => {
    let skin: string | null = null;
    if (r.metadata) {
      try {
        const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
        if (meta && meta.skin) skin = String(meta.skin);
      } catch {}
    }
    const charName = r.firstname ? `${r.firstname} ${r.lastname || ""}`.trim() : null;

    return {
      accountId: r.account_id,
      characterId: r.character_id,
      username: r.username,
      characterName: charName,
      skin,
      level: r.level,
      factionId: r.faction_id,
    };
  });

  return NextResponse.json({ players });
}
