import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { dbExecute, dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

const LEGAL_KEYS = new Set(["terms", "privacy", "refund", "cookies"]);

interface LegalRow extends RowDataPacket {
  id: number;
  page_key: string;
  slug: string;
  title_en: string;
  title_ro: string;
  content_en: string;
  content_ro: string;
  status: "draft" | "published";
  version: number;
  effective_at: string | null;
  published_at: Date | null;
  updated_at: Date;
}

const patchLegalSchema = z.object({
  title_en: z.string().min(2).max(191).optional(),
  title_ro: z.string().min(2).max(191).optional(),
  content_en: z.string().min(1).optional(),
  content_ro: z.string().min(1).optional(),
  effective_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const publishSchema = z.object({
  effective_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

async function loadByKey(key: string): Promise<LegalRow | null> {
  return dbQuerySingle<LegalRow>(
    `SELECT id, page_key, slug, title_en, title_ro, content_en, content_ro,
            status, version, effective_at, published_at, updated_at
     FROM panel_legal_pages
     WHERE page_key = ?
     LIMIT 1`,
    [key]
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const key = (await params).key;
  if (!LEGAL_KEYS.has(key)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  try {
    const page = await loadByKey(key);
    if (!page) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ page });
  } catch (err) {
    console.error("[staff/cms/legal/[key]] GET", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const key = (await params).key;
  if (!LEGAL_KEYS.has(key)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  const page = await loadByKey(key);
  if (!page) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchLegalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const d = parsed.data;
  const sets: string[] = ["status = 'draft'", "updated_by_account_id = ?"];
  const vals: unknown[] = [auth.accountId];

  if (d.title_en !== undefined) { sets.push("title_en = ?"); vals.push(d.title_en); }
  if (d.title_ro !== undefined) { sets.push("title_ro = ?"); vals.push(d.title_ro); }
  if (d.content_en !== undefined) { sets.push("content_en = ?"); vals.push(d.content_en); }
  if (d.content_ro !== undefined) { sets.push("content_ro = ?"); vals.push(d.content_ro); }
  if (d.effective_at !== undefined) { sets.push("effective_at = ?"); vals.push(d.effective_at); }

  try {
    vals.push(page.id);
    await dbExecute(`UPDATE panel_legal_pages SET ${sets.join(", ")} WHERE id = ?`, vals);
    await writeCmsAudit(auth, "cms_legal_draft_save", "legal_page", page.id, { page_key: key });
    const updated = await loadByKey(key);
    return NextResponse.json({ page: updated });
  } catch (err) {
    console.error("[staff/cms/legal/[key]] PATCH", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const key = (await params).key;
  if (!LEGAL_KEYS.has(key)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  const page = await loadByKey(key);
  if (!page) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const nextVersion = page.version + 1;
  const effectiveAt = parsed.data.effective_at ?? page.effective_at;

  try {
    await dbTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO panel_legal_page_revisions
           (page_id, version, title_en, title_ro, content_en, content_ro, effective_at, changed_by_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          page.id,
          nextVersion,
          page.title_en,
          page.title_ro,
          page.content_en,
          page.content_ro,
          effectiveAt,
          auth.accountId,
        ]
      );

      await conn.execute(
        `UPDATE panel_legal_pages
         SET status = 'published', version = ?, effective_at = ?, published_at = NOW(), updated_by_account_id = ?
         WHERE id = ?`,
        [nextVersion, effectiveAt, auth.accountId, page.id]
      );
    });

    await writeCmsAudit(auth, "cms_legal_publish", "legal_page", page.id, {
      page_key: key,
      version: nextVersion,
    });

    const updated = await loadByKey(key);
    return NextResponse.json({ page: updated });
  } catch (err) {
    console.error("[staff/cms/legal/[key]] POST publish", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
