import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { UPDATE_LIKERS_SQL } from "@/lib/update-likers-query";
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

  const rows = await dbQuery<LikerRow>(UPDATE_LIKERS_SQL, [update.id]);

  return NextResponse.json({ likers: rows });
}
