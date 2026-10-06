import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { parseSlug } from "@/lib/cms/slug";
import { dbExecute, dbQuery, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface ArticleListRow extends RowDataPacket {
  id: number;
  category_id: number;
  category_slug: string;
  slug: string;
  title_en: string;
  title_ro: string;
  summary_en: string | null;
  summary_ro: string | null;
  status: "draft" | "published";
  is_featured: number;
  sort_order: number;
  updated_at: Date;
  published_at: Date | null;
}

const createArticleSchema = z.object({
  category_id: z.number().int().positive(),
  slug: z.string(),
  title_en: z.string().min(2).max(191),
  title_ro: z.string().min(2).max(191),
  summary_en: z.string().max(512).nullable().optional(),
  summary_ro: z.string().max(512).nullable().optional(),
  content_en: z.string().min(1),
  content_ro: z.string().min(1),
  status: z.enum(["draft", "published"]).optional(),
  is_featured: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("category_id");
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim().slice(0, 120);

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (categoryId) {
    const cid = parseInt(categoryId, 10);
    if (Number.isFinite(cid)) {
      where.push("a.category_id = ?");
      params.push(cid);
    }
  }
  if (status === "draft" || status === "published") {
    where.push("a.status = ?");
    params.push(status);
  }
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where.push("(a.title_en LIKE ? OR a.title_ro LIKE ? OR a.slug LIKE ?)");
    params.push(like, like, like);
  }

  try {
    const articles = await dbQuery<ArticleListRow>(
      `SELECT a.id, a.category_id, c.slug AS category_slug, a.slug,
              a.title_en, a.title_ro, a.summary_en, a.summary_ro,
              a.status, a.is_featured, a.sort_order, a.updated_at, a.published_at
       FROM panel_wiki_articles a
       INNER JOIN panel_wiki_categories c ON c.id = a.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY a.updated_at DESC
       LIMIT 200`,
      params
    );

    return NextResponse.json({
      articles: articles.map((a) => ({
        ...a,
        is_featured: Boolean(a.is_featured),
      })),
    });
  } catch (err) {
    console.error("[staff/cms/wiki/articles] GET", err);
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

  const parsed = createArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const slug = parseSlug(parsed.data.slug);
  if (!slug) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 422 });
  }

  interface CatRow extends RowDataPacket { id: number }
  const cat = await dbQuerySingle<CatRow>(
    `SELECT id FROM panel_wiki_categories WHERE id = ? LIMIT 1`,
    [parsed.data.category_id]
  );
  if (!cat) {
    return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  }

  const status = parsed.data.status ?? "draft";
  const publishedAt = status === "published" ? new Date() : null;

  try {
    const result = await dbExecute(
      `INSERT INTO panel_wiki_articles
         (category_id, slug, title_en, title_ro, summary_en, summary_ro, content_en, content_ro,
          status, is_featured, sort_order, created_by_account_id, updated_by_account_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parsed.data.category_id,
        slug,
        parsed.data.title_en,
        parsed.data.title_ro,
        parsed.data.summary_en ?? null,
        parsed.data.summary_ro ?? null,
        parsed.data.content_en,
        parsed.data.content_ro,
        status,
        parsed.data.is_featured ? 1 : 0,
        parsed.data.sort_order ?? 0,
        auth.accountId,
        auth.accountId,
        publishedAt,
      ]
    );

    await writeCmsAudit(auth, "cms_wiki_article_create", "wiki_article", result.insertId, { slug, status });

    return NextResponse.json({ id: result.insertId, slug });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    console.error("[staff/cms/wiki/articles] POST", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
