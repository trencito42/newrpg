import { dbQuery, dbQuerySingle } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import type { RowDataPacket } from "mysql2";

export interface WikiCategoryPublic {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  articleCount: number;
}

export interface WikiArticlePublic {
  id: number;
  slug: string;
  categorySlug: string;
  categoryName: string;
  title: string;
  summary: string | null;
  content: string;
  isFeatured: boolean;
  updatedAt: Date;
  publishedAt: Date | null;
}

interface CatRow extends RowDataPacket {
  id: number;
  slug: string;
  name_en: string;
  name_ro: string;
  description_en: string | null;
  description_ro: string | null;
  icon: string;
  article_count: number;
}

interface ArticleRow extends RowDataPacket {
  id: number;
  slug: string;
  category_slug: string;
  category_name_en: string;
  category_name_ro: string;
  title_en: string;
  title_ro: string;
  summary_en: string | null;
  summary_ro: string | null;
  content_en: string;
  content_ro: string;
  is_featured: number;
  updated_at: Date;
  published_at: Date | null;
}

function mapArticle(row: ArticleRow, locale: Locale): WikiArticlePublic {
  const ro = locale === "ro";
  return {
    id: row.id,
    slug: row.slug,
    categorySlug: row.category_slug,
    categoryName: ro ? row.category_name_ro : row.category_name_en,
    title: ro ? row.title_ro : row.title_en,
    summary: ro ? row.summary_ro : row.summary_en,
    content: ro ? row.content_ro : row.content_en,
    isFeatured: Boolean(row.is_featured),
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

const articleSelect = `
  a.id, a.slug, c.slug AS category_slug, c.name_en AS category_name_en, c.name_ro AS category_name_ro,
  a.title_en, a.title_ro, a.summary_en, a.summary_ro, a.content_en, a.content_ro,
  a.is_featured, a.updated_at, a.published_at
`;

export async function fetchWikiCategories(locale: Locale): Promise<WikiCategoryPublic[]> {
  const ro = locale === "ro";
  const rows = await dbQuery<CatRow>(
    `SELECT c.id, c.slug, c.name_en, c.name_ro, c.description_en, c.description_ro, c.icon,
            COUNT(a.id) AS article_count
     FROM panel_wiki_categories c
     LEFT JOIN panel_wiki_articles a ON a.category_id = c.id AND a.status = 'published'
     WHERE c.is_visible = 1
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.id ASC`
  );
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: ro ? c.name_ro : c.name_en,
    description: ro ? c.description_ro : c.description_en,
    icon: c.icon,
    articleCount: Number(c.article_count) || 0,
  }));
}

export async function fetchPublishedWikiArticle(slug: string, locale: Locale): Promise<WikiArticlePublic | null> {
  const row = await dbQuerySingle<ArticleRow>(
    `SELECT ${articleSelect}
     FROM panel_wiki_articles a
     INNER JOIN panel_wiki_categories c ON c.id = a.category_id AND c.is_visible = 1
     WHERE a.slug = ? AND a.status = 'published'
     LIMIT 1`,
    [slug]
  );
  return row ? mapArticle(row, locale) : null;
}

export async function searchPublishedWikiArticles(
  locale: Locale,
  query: string,
  limit = 20
): Promise<WikiArticlePublic[]> {
  const q = query.trim();
  if (!q || q.length > 120) return [];
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await dbQuery<ArticleRow>(
    `SELECT ${articleSelect}
     FROM panel_wiki_articles a
     INNER JOIN panel_wiki_categories c ON c.id = a.category_id AND c.is_visible = 1
     WHERE a.status = 'published'
       AND (a.title_en LIKE ? OR a.title_ro LIKE ? OR a.summary_en LIKE ? OR a.summary_ro LIKE ?)
     ORDER BY a.updated_at DESC
     LIMIT ?`,
    [like, like, like, like, limit]
  );
  return rows.map((r) => mapArticle(r, locale));
}

export async function fetchFeaturedWikiArticles(locale: Locale, limit = 6): Promise<WikiArticlePublic[]> {
  const rows = await dbQuery<ArticleRow>(
    `SELECT ${articleSelect}
     FROM panel_wiki_articles a
     INNER JOIN panel_wiki_categories c ON c.id = a.category_id AND c.is_visible = 1
     WHERE a.status = 'published' AND a.is_featured = 1
     ORDER BY a.sort_order ASC, a.updated_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => mapArticle(r, locale));
}

export async function fetchRecentWikiArticles(locale: Locale, limit = 8): Promise<WikiArticlePublic[]> {
  const rows = await dbQuery<ArticleRow>(
    `SELECT ${articleSelect}
     FROM panel_wiki_articles a
     INNER JOIN panel_wiki_categories c ON c.id = a.category_id AND c.is_visible = 1
     WHERE a.status = 'published'
     ORDER BY a.updated_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => mapArticle(r, locale));
}

export async function fetchWikiArticlesByCategory(categorySlug: string, locale: Locale): Promise<WikiArticlePublic[]> {
  const rows = await dbQuery<ArticleRow>(
    `SELECT ${articleSelect}
     FROM panel_wiki_articles a
     INNER JOIN panel_wiki_categories c ON c.id = a.category_id AND c.is_visible = 1
     WHERE a.status = 'published' AND c.slug = ?
     ORDER BY a.sort_order ASC, a.title_en ASC`,
    [categorySlug]
  );
  return rows.map((r) => mapArticle(r, locale));
}
