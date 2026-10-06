import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { parseSlug } from "@/lib/cms/slug";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchCategorySchema = z.object({
  slug: z.string().optional(),
  name_en: z.string().min(2).max(128).optional(),
  name_ro: z.string().min(2).max(128).optional(),
  description_en: z.string().max(255).nullable().optional(),
  description_ro: z.string().max(255).nullable().optional(),
  icon: z.string().max(32).optional(),
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

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const categoryId = parseInt((await params).id, 10);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  interface CatRow extends RowDataPacket { id: number }
  const existing = await dbQuerySingle<CatRow>(
    `SELECT id FROM panel_wiki_categories WHERE id = ? LIMIT 1`,
    [categoryId]
  );
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const d = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (d.slug !== undefined) {
    const slug = parseSlug(d.slug);
    if (!slug) return NextResponse.json({ error: "invalid_slug" }, { status: 422 });
    sets.push("slug = ?");
    vals.push(slug);
  }
  if (d.name_en !== undefined) { sets.push("name_en = ?"); vals.push(d.name_en); }
  if (d.name_ro !== undefined) { sets.push("name_ro = ?"); vals.push(d.name_ro); }
  if (d.description_en !== undefined) { sets.push("description_en = ?"); vals.push(d.description_en); }
  if (d.description_ro !== undefined) { sets.push("description_ro = ?"); vals.push(d.description_ro); }
  if (d.icon !== undefined) { sets.push("icon = ?"); vals.push(d.icon); }
  if (d.sort_order !== undefined) { sets.push("sort_order = ?"); vals.push(d.sort_order); }
  if (d.is_visible !== undefined) { sets.push("is_visible = ?"); vals.push(d.is_visible ? 1 : 0); }

  if (sets.length === 0) {
    return NextResponse.json({ success: true });
  }

  try {
    vals.push(categoryId);
    await dbExecute(`UPDATE panel_wiki_categories SET ${sets.join(", ")} WHERE id = ?`, vals);
    await writeCmsAudit(auth, "cms_wiki_category_update", "wiki_category", categoryId, d);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    console.error("[staff/cms/wiki/categories/[id]] PATCH", err);
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

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const categoryId = parseInt((await params).id, 10);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  interface CountRow extends RowDataPacket { cnt: number }
  const countRow = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS cnt FROM panel_wiki_articles WHERE category_id = ?`,
    [categoryId]
  );
  if ((countRow?.cnt ?? 0) > 0) {
    return NextResponse.json({ error: "category_has_articles" }, { status: 409 });
  }

  try {
    const result = await dbExecute(`DELETE FROM panel_wiki_categories WHERE id = ?`, [categoryId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await writeCmsAudit(auth, "cms_wiki_category_delete", "wiki_category", categoryId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[staff/cms/wiki/categories/[id]] DELETE", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
