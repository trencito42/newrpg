import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import type { Forum } from "@/lib/forum-types";

export const dynamic = "force-dynamic";

interface ForumRow extends RowDataPacket, Forum {}

const CreateForumSchema = z.object({
  category_id: z.number().int().positive(),
  parent_forum_id: z.number().int().positive().nullable().optional(),
  name: z.string().min(2).max(64),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  description: z.string().max(255).optional(),
  icon: z.string().max(32).optional().default("MessageSquare"),
  access_type: z.enum(["public", "registered", "staff", "faction", "clan", "custom"]).default("public"),
  access_target: z.string().max(64).nullable().optional(),
  sort_order: z.number().int().optional().default(0),
  is_locked: z.boolean().optional().default(false),
  is_visible: z.boolean().optional().default(true),
  topic_template: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.adminLevel < 1) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const forums = await dbQuery<ForumRow>(
      `SELECT * FROM panel_forums ORDER BY category_id ASC, sort_order ASC`
    );

    return NextResponse.json({
      forums: forums.map((f) => ({
        ...f,
        is_locked: Boolean(f.is_locked),
        is_visible: Boolean(f.is_visible),
      })),
    });
  } catch (err) {
    console.error("[forum/admin/forums] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.adminLevel < 1) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateForumSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const d = parsed.data;
    const result = await dbExecute(
      `INSERT INTO panel_forums
         (category_id, parent_forum_id, name, slug, description, icon, access_type, access_target,
          sort_order, is_locked, is_visible, topic_template)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.category_id,
        d.parent_forum_id ?? null,
        d.name,
        d.slug,
        d.description ?? null,
        d.icon,
        d.access_type,
        d.access_target ?? null,
        d.sort_order,
        d.is_locked ? 1 : 0,
        d.is_visible ? 1 : 0,
        d.topic_template ?? null,
      ]
    );

    await dbExecute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'create_forum', 'forum', ?)`,
      [session.accountId, session.username, result.insertId]
    );

    return NextResponse.json({ forumId: result.insertId });
  } catch (err) {
    console.error("[forum/admin/forums] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
