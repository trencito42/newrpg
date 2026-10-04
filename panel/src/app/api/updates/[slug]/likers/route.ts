import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface LikerRow extends RowDataPacket {
  display_name: string;
  username: string;
  faction_id: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  clan_tag_style: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ likers: [] });

  interface UpdateRow extends RowDataPacket { id: number; }
  const update = await dbQuerySingle<UpdateRow>(
    "SELECT id FROM panel_updates WHERE slug = ? LIMIT 1",
    [slug]
  );
  if (!update) return NextResponse.json({ likers: [] });

  const rows = await dbQuery<LikerRow>(
    `SELECT
       CASE WHEN r.reactor_type = 'character'
            THEN CONCAT(c.firstname, ' ', c.lastname)
            ELSE a_direct.username END AS display_name,
       COALESCE(a_char.username, a_direct.username) AS username,
       CASE WHEN r.reactor_type = 'character'
            THEN JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction'))
            ELSE NULL END AS faction_id,
       CASE WHEN r.reactor_type = 'character' THEN cl.tag       ELSE NULL END AS clan_tag,
       CASE WHEN r.reactor_type = 'character' THEN cl.tag_color ELSE NULL END AS clan_color,
       CASE WHEN r.reactor_type = 'character' THEN cl.tag_style ELSE NULL END AS clan_tag_style
     FROM panel_update_reactions r
     LEFT JOIN characters c ON r.reactor_type = 'character' AND c.id = r.reactor_id
     LEFT JOIN players pl ON pl.id = c.player_id
     LEFT JOIN accounts a_char ON a_char.id = pl.account_id
     LEFT JOIN accounts a_direct ON r.reactor_type = 'account' AND a_direct.id = r.reactor_id
     LEFT JOIN clan_members clanm ON clanm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = clanm.clan_id
     WHERE r.update_id = ? AND r.reaction = 'like'
     ORDER BY r.created_at DESC
     LIMIT 20`,
    [update.id]
  );

  return NextResponse.json({ likers: rows });
}
