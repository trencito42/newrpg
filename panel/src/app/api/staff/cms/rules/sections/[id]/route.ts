import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { parseSlug } from "@/lib/cms/slug";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSectionSchema = z.object({
  slug: z.string().optional(),
  title_en: z.string().min(2).max(191).optional(),
  title_ro: z.string().min(2).max(191).optional(),
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

  const sectionId = parseInt((await params).id, 10);
  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  interface SecRow extends RowDataPacket { id: number }
  const existing = await dbQuerySingle<SecRow>(
    `SELECT id FROM panel_rule_sections WHERE id = ? LIMIT 1`,
    [sectionId]
  );
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
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
  if (d.title_en !== undefined) { sets.push("title_en = ?"); vals.push(d.title_en); }
  if (d.title_ro !== undefined) { sets.push("title_ro = ?"); vals.push(d.title_ro); }
  if (d.sort_order !== undefined) { sets.push("sort_order = ?"); vals.push(d.sort_order); }
  if (d.is_visible !== undefined) { sets.push("is_visible = ?"); vals.push(d.is_visible ? 1 : 0); }

  if (sets.length === 0) {
    return NextResponse.json({ success: true });
  }

  try {
    vals.push(sectionId);
    await dbExecute(`UPDATE panel_rule_sections SET ${sets.join(", ")} WHERE id = ?`, vals);
    await writeCmsAudit(auth, "cms_rule_section_update", "rule_section", sectionId, d);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    console.error("[staff/cms/rules/sections/[id]] PATCH", err);
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

  const sectionId = parseInt((await params).id, 10);
  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const result = await dbExecute(`DELETE FROM panel_rule_sections WHERE id = ?`, [sectionId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await writeCmsAudit(auth, "cms_rule_section_delete", "rule_section", sectionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[staff/cms/rules/sections/[id]] DELETE", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
