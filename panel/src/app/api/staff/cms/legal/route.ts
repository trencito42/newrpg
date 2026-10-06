import { NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { dbQuery } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  try {
    const pages = await dbQuery<LegalRow>(
      `SELECT id, page_key, slug, title_en, title_ro, content_en, content_ro,
              status, version, effective_at, published_at, updated_at
       FROM panel_legal_pages
       ORDER BY page_key ASC`
    );
    return NextResponse.json({ pages });
  } catch (err) {
    console.error("[staff/cms/legal] GET", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
