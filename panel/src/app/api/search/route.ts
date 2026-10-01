import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface SearchRow extends RowDataPacket {
  id: number;
  firstname: string;
  lastname: string;
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
    `SELECT c.id, c.firstname, c.lastname, c.level, c.job
     FROM characters c
     WHERE c.firstname LIKE ? OR c.lastname LIKE ? OR CONCAT(c.firstname, ' ', c.lastname) LIKE ?
     ORDER BY c.level DESC, c.last_played DESC
     LIMIT 8`,
    [pattern, pattern, pattern]
  );

  const results = rows.map((r) => {
    const slug =
      r.lastname && r.lastname.trim().length > 0
        ? `${r.firstname}_${r.lastname.trim()}`
        : r.firstname;
    return {
      id: r.id,
      slug,
      name: `${r.firstname} ${r.lastname || ""}`.trim(),
      level: Number(r.level) || 1,
      job: r.job || "Unemployed",
    };
  });

  return NextResponse.json({ results });
}
