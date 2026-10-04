import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(_req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.selectedCharacterId) {
    return NextResponse.json({ photos: [] });
  }
  const charId = session.selectedCharacterId;

  interface GalleryRow extends RowDataPacket {
    media_id: number;
    url: string;
    thumbnail_url: string | null;
    width: number | null;
    height: number | null;
  }

  const rows = await dbQuery<GalleryRow>(
    `SELECT pg.media_id, pm.url, pm.thumbnail_url, pm.width, pm.height
     FROM phone_gallery pg
     JOIN phone_media pm ON pm.id = pg.media_id
     WHERE pg.character_id = ? AND pg.deleted_at IS NULL AND pm.deleted_at IS NULL
     ORDER BY pg.created_at DESC
     LIMIT 60`,
    [charId]
  );

  return NextResponse.json({ photos: rows });
}
