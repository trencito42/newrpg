import { dbQuerySingle } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import type { RowDataPacket } from "mysql2";

export interface PublicLegalPage {
  pageKey: string;
  slug: string;
  title: string;
  content: string;
  effectiveAt: string | null;
  updatedAt: Date;
  version: number;
}

interface LegalRow extends RowDataPacket {
  page_key: string;
  slug: string;
  title_en: string;
  title_ro: string;
  content_en: string;
  content_ro: string;
  effective_at: string | null;
  updated_at: Date;
  version: number;
}

export async function fetchPublishedLegalBySlug(slug: string, locale: Locale): Promise<PublicLegalPage | null> {
  try {
    const row = await dbQuerySingle<LegalRow>(
      `SELECT page_key, slug, title_en, title_ro, content_en, content_ro, effective_at, updated_at, version
       FROM panel_legal_pages
       WHERE slug = ? AND status = 'published'
       LIMIT 1`,
      [slug]
    );
    if (!row) return null;
    const ro = locale === "ro";
    return {
      pageKey: row.page_key,
      slug: row.slug,
      title: ro ? row.title_ro : row.title_en,
      content: ro ? row.content_ro : row.content_en,
      effectiveAt: row.effective_at,
      updatedAt: row.updated_at,
      version: row.version,
    };
  } catch {
    return null;
  }
}

export async function fetchPublishedLegalByKey(
  key: string,
  locale: Locale
): Promise<(PublicLegalPage & { isDraft?: boolean }) | null> {
  try {
    let row = await dbQuerySingle<LegalRow>(
      `SELECT page_key, slug, title_en, title_ro, content_en, content_ro, effective_at, updated_at, version
       FROM panel_legal_pages
       WHERE page_key = ? AND status = 'published'
       LIMIT 1`,
      [key]
    );
    let isDraft = false;
    if (!row) {
      row = await dbQuerySingle<LegalRow>(
        `SELECT page_key, slug, title_en, title_ro, content_en, content_ro, effective_at, updated_at, version
         FROM panel_legal_pages
         WHERE page_key = ? AND status = 'draft'
         LIMIT 1`,
        [key]
      );
      isDraft = !!row;
    }
    if (!row) return null;
    const ro = locale === "ro";
    return {
      pageKey: row.page_key,
      slug: row.slug,
      title: ro ? row.title_ro : row.title_en,
      content: ro ? row.content_ro : row.content_en,
      effectiveAt: row.effective_at,
      updatedAt: row.updated_at,
      version: row.version,
      isDraft,
    };
  } catch {
    return null;
  }
}
