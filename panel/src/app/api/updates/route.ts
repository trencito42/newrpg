import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket, ResultSetHeader } from "mysql2";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-") // collapse dashes
    .replace(/^-+/, "") // trim - from start of text
    .replace(/-+$/, ""); // trim - from end of text
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10) || 12));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (category && category !== "all" && category !== "toate") {
      conditions.push("category = ?");
      params.push(category);
    }

    if (search && search.trim().length > 0) {
      conditions.push("(title LIKE ? OR summary LIKE ? OR content LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.join(" AND ");

    const countRow = await dbQuerySingle<{ total: number } & RowDataPacket>(
      `SELECT COUNT(*) AS total FROM panel_updates WHERE ${whereClause}`,
      params
    );
    const total = countRow?.total || 0;

    const updates = await dbQuery<
      {
        id: number;
        slug: string;
        title: string;
        summary: string | null;
        category: string;
        cover_image: string | null;
        author_account_id: number;
        author_name: string;
        is_pinned: number;
        views_count: number;
        created_at: string;
        updated_at: string;
      } & RowDataPacket
    >(
      `SELECT id, slug, title, summary, category, cover_image, author_account_id, author_name, is_pinned, views_count, created_at, updated_at
       FROM panel_updates
       WHERE ${whereClause}
       ORDER BY is_pinned DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      updates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error("[Updates API Error]", error);
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginWrite(req)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Must be Admin >= 1 OR have isAuthor permission
    const canPost = session.adminLevel >= 1 || session.isAuthor;
    if (!canPost) {
      return NextResponse.json({ error: "forbidden", message: "Nu ai permisiunea de a posta actualizări." }, { status: 403 });
    }

    const body = await req.json();
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    const summary = (body.summary || "").trim() || (content.length > 180 ? content.substring(0, 177) + "..." : content);
    const category = (body.category || "update").trim().toLowerCase();
    const coverImage = (body.cover_image || "").trim() || null;
    const isPinned = session.adminLevel >= 1 ? (body.is_pinned ? 1 : 0) : 0;

    if (!title || title.length < 3) {
      return NextResponse.json({ error: "validation_failed", message: "Titlul trebuie să aibă minim 3 caractere." }, { status: 400 });
    }
    if (!content || content.length < 10) {
      return NextResponse.json({ error: "validation_failed", message: "Conținutul trebuie să aibă minim 10 caractere." }, { status: 400 });
    }

    // Build base slug
    let baseSlug = slugify(title);
    if (!baseSlug) baseSlug = "update";

    // Ensure uniqueness
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await dbQuerySingle<{ id: number } & RowDataPacket>(
        "SELECT id FROM panel_updates WHERE slug = ? LIMIT 1",
        [slug]
      );
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const result = await dbExecute(
      `INSERT INTO panel_updates (slug, title, summary, content, category, cover_image, author_account_id, author_name, is_pinned, views_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [slug, title, summary, content, category, coverImage, session.accountId, session.username, isPinned]
    );

    return NextResponse.json({
      success: true,
      slug,
      id: (result as ResultSetHeader).insertId,
    });
  } catch (error: any) {
    console.error("[Create Update Error]", error);
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}
