import { NextResponse } from "next/server";
import { getForumModSession } from "@/lib/cms/auth";
import { dbQuery } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface DestinationRow extends RowDataPacket {
  id: number;
  name: string;
  category_id: number;
  category_name_en: string;
  category_name_ro: string;
}

export async function GET() {
  const session = await getForumModSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const forums = await dbQuery<DestinationRow>(
      `SELECT f.id, f.name, f.category_id, c.name_en AS category_name_en, c.name_ro AS category_name_ro
       FROM panel_forums f
       INNER JOIN panel_forum_categories c ON c.id = f.category_id
       WHERE f.is_visible = 1
       ORDER BY c.sort_order ASC, f.sort_order ASC, f.id ASC`
    );

    return NextResponse.json({
      forums: forums.map((f) => ({
        id: f.id,
        name: f.name,
        categoryId: f.category_id,
        categoryNameEn: f.category_name_en,
        categoryNameRo: f.category_name_ro,
      })),
    });
  } catch (err) {
    console.error("[forum/mod/destinations] GET", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
