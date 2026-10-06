import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { parseSlug } from "@/lib/cms/slug";
import { dbExecute, dbQuery } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface SectionRow extends RowDataPacket {
  id: number;
  slug: string;
  title_en: string;
  title_ro: string;
  sort_order: number;
  is_visible: number;
  rule_count: number;
}

const createSectionSchema = z.object({
  slug: z.string(),
  title_en: z.string().min(2).max(191),
  title_ro: z.string().min(2).max(191),
  sort_order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  try {
    const sections = await dbQuery<SectionRow>(
      `SELECT s.*,
              (SELECT COUNT(*) FROM panel_rules r WHERE r.section_id = s.id) AS rule_count
       FROM panel_rule_sections s
       ORDER BY s.sort_order ASC, s.id ASC`
    );
    return NextResponse.json({
      sections: sections.map((s) => ({
        ...s,
        is_visible: Boolean(s.is_visible),
        rule_count: Number(s.rule_count) || 0,
      })),
    });
  } catch (err) {
    console.error("[staff/cms/rules/sections] GET", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const slug = parseSlug(parsed.data.slug);
  if (!slug) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 422 });
  }

  try {
    const result = await dbExecute(
      `INSERT INTO panel_rule_sections (slug, title_en, title_ro, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?)`,
      [
        slug,
        parsed.data.title_en,
        parsed.data.title_ro,
        parsed.data.sort_order ?? 0,
        parsed.data.is_visible === false ? 0 : 1,
      ]
    );

    await writeCmsAudit(auth, "cms_rule_section_create", "rule_section", result.insertId, { slug });
    return NextResponse.json({ id: result.insertId, slug });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    console.error("[staff/cms/rules/sections] POST", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
