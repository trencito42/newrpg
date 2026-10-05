import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface CategoryRow extends RowDataPacket { id: number }

const UpdateCategorySchema = z.object({
  name_en: z.string().min(2).max(64).optional(),
  name_ro: z.string().min(2).max(64).optional(),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
  description_en: z.string().max(255).nullable().optional(),
  description_ro: z.string().max(255).nullable().optional(),
  sort_order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const categoryId = parseInt(id, 10);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = UpdateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const cat = await dbQuerySingle<CategoryRow>(
      `SELECT id FROM panel_forum_categories WHERE id = ? LIMIT 1`,
      [categoryId]
    );

    if (!cat) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const d = parsed.data;
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (d.name_en !== undefined) { sets.push("name_en = ?"); vals.push(d.name_en); }
    if (d.name_ro !== undefined) { sets.push("name_ro = ?"); vals.push(d.name_ro); }
    if (d.slug !== undefined) { sets.push("slug = ?"); vals.push(d.slug); }
    if (d.description_en !== undefined) { sets.push("description_en = ?"); vals.push(d.description_en); }
    if (d.description_ro !== undefined) { sets.push("description_ro = ?"); vals.push(d.description_ro); }
    if (d.sort_order !== undefined) { sets.push("sort_order = ?"); vals.push(d.sort_order); }
    if (d.is_visible !== undefined) { sets.push("is_visible = ?"); vals.push(d.is_visible ? 1 : 0); }

    if (sets.length === 0) {
      return NextResponse.json({ success: true });
    }

    vals.push(categoryId);
    await dbExecute(`UPDATE panel_forum_categories SET ${sets.join(", ")} WHERE id = ?`, vals);

    await dbExecute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'update_category', 'category', ?)`,
      [session.accountId, session.username, categoryId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/admin/categories/[id]] PATCH error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const categoryId = parseInt(id, 10);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    interface ForumCountRow extends RowDataPacket { cnt: number }
    const countRow = await dbQuerySingle<ForumCountRow>(
      `SELECT COUNT(*) AS cnt FROM panel_forums WHERE category_id = ?`,
      [categoryId]
    );

    if ((countRow?.cnt ?? 0) > 0) {
      return NextResponse.json({ error: "category_has_forums" }, { status: 409 });
    }

    await dbExecute(`DELETE FROM panel_forum_categories WHERE id = ?`, [categoryId]);

    await dbExecute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'delete_category', 'category', ?)`,
      [session.accountId, session.username, categoryId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/admin/categories/[id]] DELETE error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
