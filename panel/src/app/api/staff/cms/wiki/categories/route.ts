import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { parseSlug } from "@/lib/cms/slug";
import { dbExecute, dbQuery } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface CategoryRow extends RowDataPacket {
  id: number;
  slug: string;
  name_en: string;
  name_ro: string;
  description_en: string | null;
  description_ro: string | null;
  icon: string;
  sort_order: number;
  is_visible: number;
  article_count: number;
  created_at: Date;
  updated_at: Date;
}

const createCategorySchema = z.object({
  slug: z.string(),
  name_en: z.string().min(2).max(128),
  name_ro: z.string().min(2).max(128),
  description_en: z.string().max(255).nullable().optional(),
  description_ro: z.string().max(255).nullable().optional(),
  icon: z.string().max(32).optional(),
  sort_order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  try {
    const categories = await dbQuery<CategoryRow>(
      `SELECT c.*,
              (SELECT COUNT(*) FROM panel_wiki_articles a WHERE a.category_id = c.id) AS article_count
       FROM panel_wiki_categories c
       ORDER BY c.sort_order ASC, c.id ASC`
    );
    return NextResponse.json({
      categories: categories.map((c) => ({
        ...c,
        is_visible: Boolean(c.is_visible),
        article_count: Number(c.article_count) || 0,
      })),
    });
  } catch (err) {
    console.error("[staff/cms/wiki/categories] GET", err);
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

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const slug = parseSlug(parsed.data.slug);
  if (!slug) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 422 });
  }

  try {
    const result = await dbExecute(
      `INSERT INTO panel_wiki_categories
         (slug, name_en, name_ro, description_en, description_ro, icon, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        parsed.data.name_en,
        parsed.data.name_ro,
        parsed.data.description_en ?? null,
        parsed.data.description_ro ?? null,
        parsed.data.icon ?? "BookOpen",
        parsed.data.sort_order ?? 0,
        parsed.data.is_visible === false ? 0 : 1,
      ]
    );

    await writeCmsAudit(auth, "cms_wiki_category_create", "wiki_category", result.insertId, { slug });

    return NextResponse.json({ id: result.insertId, slug });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    console.error("[staff/cms/wiki/categories] POST", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
