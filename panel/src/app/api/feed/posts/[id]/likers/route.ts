import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface LikerRow extends RowDataPacket {
  character_id: number;
  firstname: string;
  lastname: string;
  faction_id: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  clan_tag_style: string | null;
  username: string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);
  if (!Number.isFinite(postId)) return NextResponse.json({ likers: [] });

  const rows = await dbQuery<LikerRow>(
    `SELECT spl.character_id, c.firstname, c.lastname,
            JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction')) AS faction_id,
            cl.tag AS clan_tag, cl.tag_color AS clan_color, cl.tag_style AS clan_tag_style,
            a.username
     FROM social_post_likes spl
     JOIN characters c ON c.id = spl.character_id
     JOIN players pl ON pl.id = c.player_id
     JOIN accounts a ON a.id = pl.account_id
     LEFT JOIN clan_members clanm ON clanm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = clanm.clan_id
     WHERE spl.post_id = ?
     ORDER BY spl.created_at DESC
     LIMIT 20`,
    [postId]
  );

  return NextResponse.json({ likers: rows });
}
