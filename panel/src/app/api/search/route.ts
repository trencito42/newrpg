import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface SearchRow extends RowDataPacket {
  id: number;
  username: string;
  level: number;
  job: string;
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
    `SELECT c.id, a.username, c.level, c.job
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN characters c ON c.player_id = p.id
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
  }));

  return NextResponse.json({ results });
}
