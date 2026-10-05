import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { canAccessForum } from "@/lib/forum-permissions";
import type { Forum, ForumCategory, ForumCategoryWithForums } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface CategoryRow extends RowDataPacket, ForumCategory {}
interface ForumRow extends RowDataPacket, Forum {}

export async function GET(_req: NextRequest) {
  try {
    const session = await getCurrentSession();

    const categories = await dbQuery<CategoryRow>(
      `SELECT id, name_en, name_ro, slug, description_en, description_ro, sort_order, is_visible, created_at
       FROM panel_forum_categories
       WHERE is_visible = 1
       ORDER BY sort_order ASC`
    );

    const forums = await dbQuery<ForumRow>(
      `SELECT id, category_id, parent_forum_id, name, slug, description, icon,
              access_type, access_target, sort_order, is_locked, is_visible,
              topic_count, post_count, last_topic_id, last_topic_title,
              last_post_at, last_post_account_id, last_post_username, created_at
       FROM panel_forums
       ORDER BY sort_order ASC`
    );

    // Filter forums by access
    const accessChecks = await Promise.all(
      forums.map(async (f) => ({
        forum: f,
        canAccess: await canAccessForum(session, f),
      }))
    );

    const accessibleForums = accessChecks
      .filter((x) => x.canAccess)
      .map((x) => x.forum);

    const result: ForumCategoryWithForums[] = categories.map((cat) => ({
      ...cat,
      is_visible: Boolean(cat.is_visible),
      forums: accessibleForums
        .filter((f) => f.category_id === cat.id && f.parent_forum_id === null)
        .map((f) => ({
          ...f,
          is_locked: Boolean(f.is_locked),
          is_visible: Boolean(f.is_visible),
        })),
    }));

    return NextResponse.json({ categories: result });
  } catch (err) {
    console.error("[forum/categories] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
