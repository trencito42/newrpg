import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { parseSlug } from "@/lib/cms/slug";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface ArticleRow extends RowDataPacket {
  id: number;
  category_id: number;
  category_slug: string;
  slug: string;
  title_en: string;
  title_ro: string;
  summary_en: string | null;
  summary_ro: string | null;
  content_en: string;
  content_ro: string;
  status: "draft" | "published";
  is_featured: number;
  sort_order: number;
  created_by_account_id: number | null;
  updated_by_account_id: number | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const patchArticleSchema = z.object({
  category_id: z.number().int().positive().optional(),
  slug: z.string().optional(),
  title_en: z.string().min(2).max(191).optional(),
  title_ro: z.string().min(2).max(191).optional(),
  summary_en: z.string().max(512).nullable().optional(),
  summary_ro: z.string().max(512).nullable().optional(),
  content_en: z.string().min(1).optional(),
  content_ro: z.string().min(1).optional(),
  status: z.enum(["draft", "published"]).optional(),
  is_featured: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

async function loadArticle(articleId: number): Promise<ArticleRow | null> {
  return dbQuerySingle<ArticleRow>(
    `SELECT a.*, c.slug AS category_slug
     FROM panel_wiki_articles a
     INNER JOIN panel_wiki_categories c ON c.id = a.category_id
     WHERE a.id = ?
     LIMIT 1`,
    [articleId]
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const articleId = parseInt((await params).id, 10);
  if (!Number.isFinite(articleId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const article = await loadArticle(articleId);
    if (!article) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      article: { ...article, is_featured: Boolean(article.is_featured) },
    });
  } catch (err) {
    console.error("[staff/cms/wiki/articles/[id]] GET", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const articleId = parseInt((await params).id, 10);
  if (!Number.isFinite(articleId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const existing = await loadArticle(articleId);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const d = parsed.data;
  const sets: string[] = ["updated_by_account_id = ?"];
  const vals: unknown[] = [auth.accountId];

  if (d.category_id !== undefined) {
    interface CatRow extends RowDataPacket { id: number }
    const cat = await dbQuerySingle<CatRow>(
      `SELECT id FROM panel_wiki_categories WHERE id = ? LIMIT 1`,
      [d.category_id]
    );
    if (!cat) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    sets.push("category_id = ?");
    vals.push(d.category_id);
  }
  if (d.slug !== undefined) {
    const slug = parseSlug(d.slug);
    if (!slug) return NextResponse.json({ error: "invalid_slug" }, { status: 422 });
    sets.push("slug = ?");
    vals.push(slug);
  }
  if (d.title_en !== undefined) { sets.push("title_en = ?"); vals.push(d.title_en); }
  if (d.title_ro !== undefined) { sets.push("title_ro = ?"); vals.push(d.title_ro); }
  if (d.summary_en !== undefined) { sets.push("summary_en = ?"); vals.push(d.summary_en); }
  if (d.summary_ro !== undefined) { sets.push("summary_ro = ?"); vals.push(d.summary_ro); }
  if (d.content_en !== undefined) { sets.push("content_en = ?"); vals.push(d.content_en); }
  if (d.content_ro !== undefined) { sets.push("content_ro = ?"); vals.push(d.content_ro); }
  if (d.is_featured !== undefined) { sets.push("is_featured = ?"); vals.push(d.is_featured ? 1 : 0); }
  if (d.sort_order !== undefined) { sets.push("sort_order = ?"); vals.push(d.sort_order); }
  if (d.status !== undefined) {
    sets.push("status = ?");
    vals.push(d.status);
    if (d.status === "published" && existing.status !== "published") {
      sets.push("published_at = COALESCE(published_at, NOW())");
    }
    if (d.status === "draft") {
      sets.push("published_at = NULL");
    }
  }

  if (sets.length <= 1) {
    return NextResponse.json({ success: true });
  }

  try {
    vals.push(articleId);
    await dbExecute(`UPDATE panel_wiki_articles SET ${sets.join(", ")} WHERE id = ?`, vals);
    await writeCmsAudit(auth, "cms_wiki_article_update", "wiki_article", articleId, d);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    console.error("[staff/cms/wiki/articles/[id]] PATCH", err);
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

  const articleId = parseInt((await params).id, 10);
  if (!Number.isFinite(articleId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const result = await dbExecute(`DELETE FROM panel_wiki_articles WHERE id = ?`, [articleId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await writeCmsAudit(auth, "cms_wiki_article_delete", "wiki_article", articleId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[staff/cms/wiki/articles/[id]] DELETE", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
