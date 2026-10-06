import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const decodedSlug = decodeURIComponent(slug).trim();

    const update = await dbQuerySingle<
      {
        id: number;
        slug: string;
        title: string;
        summary: string | null;
        content: string;
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
      `SELECT id, slug, title, summary, content, category, cover_image, author_account_id, author_name, is_pinned, views_count, created_at, updated_at
       FROM panel_updates
       WHERE slug = ?
       LIMIT 1`,
      [decodedSlug]
    );

    if (!update) {
      return NextResponse.json({ error: "not_found", message: "Actualizarea nu a fost găsită." }, { status: 404 }); // i18n-ignore: pre-existing
    }

    // Increment views async
    dbExecute("UPDATE panel_updates SET views_count = views_count + 1 WHERE id = ?", [update.id]).catch(() => {});

    return NextResponse.json({
      update: {
        ...update,
        views_count: update.views_count + 1,
      },
    });
  } catch (error: any) {
    console.error("[Get Single Update Error]", error);
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isSameOriginWrite(req)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const decodedSlug = decodeURIComponent(slug).trim();

    const existing = await dbQuerySingle<
      { id: number; author_account_id: number } & RowDataPacket
    >("SELECT id, author_account_id FROM panel_updates WHERE slug = ? LIMIT 1", [decodedSlug]);

    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const isAuthor = existing.author_account_id === session.accountId;
    const isAdmin = session.adminLevel >= 1;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "forbidden", message: "Nu ai permisiunea de a edita această postare." }, { status: 403 }); // i18n-ignore: pre-existing
    }

    const body = await req.json();
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    const summary = (body.summary || "").trim() || (content.length > 180 ? content.substring(0, 177) + "..." : content);
    const category = (body.category || "update").trim().toLowerCase();
    const coverImage = (body.cover_image || "").trim() || null;
    const isPinned = session.adminLevel >= 1 ? (body.is_pinned ? 1 : 0) : 0;

    if (!title || !content) {
      return NextResponse.json({ error: "validation_failed", message: "Titlul și conținutul sunt obligatorii." }, { status: 400 }); // i18n-ignore: pre-existing
    }

    await dbExecute(
      `UPDATE panel_updates 
       SET title = ?, summary = ?, content = ?, category = ?, cover_image = ?, is_pinned = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, summary, content, category, coverImage, isPinned, existing.id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Edit Update Error]", error);
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isSameOriginWrite(req)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const decodedSlug = decodeURIComponent(slug).trim();

    const existing = await dbQuerySingle<
      { id: number; author_account_id: number } & RowDataPacket
    >("SELECT id, author_account_id FROM panel_updates WHERE slug = ? LIMIT 1", [decodedSlug]);

    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const isAuthor = existing.author_account_id === session.accountId;
    const isAdmin = session.adminLevel >= 1;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "forbidden", message: "Nu ai permisiunea de a șterge această postare." }, { status: 403 }); // i18n-ignore: pre-existing
    }

    await dbExecute("DELETE FROM panel_updates WHERE id = ?", [existing.id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Update Error]", error);
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}
