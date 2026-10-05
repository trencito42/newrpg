import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import type { ForumCategory } from "@/lib/forum-types";

export const dynamic = "force-dynamic";

interface CategoryRow extends RowDataPacket, ForumCategory {}

const CreateCategorySchema = z.object({
  name_en: z.string().min(2).max(64),
  name_ro: z.string().min(2).max(64),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  description_en: z.string().max(255).optional(),
  description_ro: z.string().max(255).optional(),
  sort_order: z.number().int().optional().default(0),
  is_visible: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.adminLevel < 1) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const categories = await dbQuery<CategoryRow>(
      `SELECT * FROM panel_forum_categories ORDER BY sort_order ASC`
    );

    return NextResponse.json({
      categories: categories.map((c) => ({
        ...c,
        is_visible: Boolean(c.is_visible),
      })),
    });
  } catch (err) {
    console.error("[forum/admin/categories] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.adminLevel < 1) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const d = parsed.data;
    const result = await dbExecute(
      `INSERT INTO panel_forum_categories
         (name_en, name_ro, slug, description_en, description_ro, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        d.name_en,
        d.name_ro,
        d.slug,
        d.description_en ?? null,
        d.description_ro ?? null,
        d.sort_order,
        d.is_visible ? 1 : 0,
      ]
    );

    await dbExecute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'create_category', 'category', ?)`,
      [session.accountId, session.username, result.insertId]
    );

    return NextResponse.json({ categoryId: result.insertId });
  } catch (err) {
    console.error("[forum/admin/categories] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
