import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface UpdateRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  author_name: string;
  is_pinned: number;
  created_at: string;
  likes_count: number;
  dislikes_count: number;
  my_reaction: string | null;
}

export async function GET(req: NextRequest) {
  const characterId = req.nextUrl.searchParams.get("character_id");
  const charId = characterId ? parseInt(characterId, 10) : null;
  const validCharId = charId && Number.isFinite(charId) && charId > 0 ? charId : null;

  try {
    const updates = await dbQuery<UpdateRow>(
      `SELECT
         u.id, u.slug, u.title, u.summary, u.category,
         u.author_name, u.is_pinned, u.created_at,
         COALESCE(SUM(r.reaction = 'like'),    0) AS likes_count,
         COALESCE(SUM(r.reaction = 'dislike'), 0) AS dislikes_count,
         MAX(CASE WHEN r.reactor_type = 'character' AND r.reactor_id = ? THEN r.reaction END) AS my_reaction
       FROM panel_updates u
       LEFT JOIN panel_update_reactions r ON r.update_id = u.id
       GROUP BY u.id
       ORDER BY u.is_pinned DESC, u.created_at DESC
       LIMIT 30`,
      [validCharId]
    );

    return NextResponse.json({ updates });
  } catch (err: any) {
    console.error("[phone/updates GET]", err);
    return NextResponse.json({ updates: [] });
  }
}
