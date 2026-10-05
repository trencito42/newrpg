import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import { isSameOriginWrite } from "@/lib/request-security";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface ForumRow extends RowDataPacket { id: number }

const UpdateForumSchema = z.object({
  category_id: z.number().int().positive().optional(),
  parent_forum_id: z.number().int().positive().nullable().optional(),
  name: z.string().min(2).max(64).optional(),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(255).nullable().optional(),
  icon: z.string().max(32).optional(),
  access_type: z.enum(["public", "registered", "staff", "faction", "clan", "custom"]).optional(),
  access_target: z.string().max(64).nullable().optional(),
  inherit_category_permissions: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  is_locked: z.boolean().optional(),
  is_visible: z.boolean().optional(),
  topic_template: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const forumId = parseInt(id, 10);
  if (!Number.isFinite(forumId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = UpdateForumSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const forum = await dbQuerySingle<ForumRow>(
      `SELECT id FROM panel_forums WHERE id = ? LIMIT 1`,
      [forumId]
    );

    if (!forum) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const d = parsed.data;
    const current = await dbQuerySingle<RowDataPacket & { category_id: number; access_type: string; access_target: string | null }>(
      "SELECT category_id, access_type, access_target FROM panel_forums WHERE id = ? LIMIT 1", [forumId]
    );
    const nextCategoryId = d.category_id ?? current?.category_id;
    if (d.category_id !== undefined) {
      const category = await dbQuerySingle<RowDataPacket>("SELECT id FROM panel_forum_categories WHERE id = ? LIMIT 1", [d.category_id]);
      if (!category) return NextResponse.json({ error: "invalid_category" }, { status: 422 });
    }
    if (d.parent_forum_id) {
      const parent = await dbQuerySingle<RowDataPacket>("SELECT id FROM panel_forums WHERE id = ? AND category_id = ? LIMIT 1", [d.parent_forum_id, nextCategoryId]);
      if (!parent || d.parent_forum_id === forumId) return NextResponse.json({ error: "invalid_parent_forum" }, { status: 422 });
    }
    const nextType = d.access_type ?? current?.access_type;
    const nextTarget = d.access_target !== undefined ? d.access_target : current?.access_target;
    if (nextType === "faction" && (!nextTarget || !CANONICAL_FACTIONS[nextTarget.toLowerCase()])) {
      return NextResponse.json({ error: "invalid_faction" }, { status: 422 });
    }
    if (nextType === "clan") {
      const clan = await dbQuerySingle<RowDataPacket>("SELECT id FROM clans WHERE id = ? LIMIT 1", [Number(nextTarget)]);
      if (!clan) return NextResponse.json({ error: "invalid_clan" }, { status: 422 });
    }
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (d.category_id !== undefined) { sets.push("category_id = ?"); vals.push(d.category_id); }
    if (d.parent_forum_id !== undefined) { sets.push("parent_forum_id = ?"); vals.push(d.parent_forum_id); }
    if (d.name !== undefined) { sets.push("name = ?"); vals.push(d.name); }
    if (d.slug !== undefined) { sets.push("slug = ?"); vals.push(d.slug); }
    if (d.description !== undefined) { sets.push("description = ?"); vals.push(d.description); }
    if (d.icon !== undefined) { sets.push("icon = ?"); vals.push(d.icon); }
    if (d.access_type !== undefined) { sets.push("access_type = ?"); vals.push(d.access_type); }
    if (d.access_target !== undefined) { sets.push("access_target = ?"); vals.push(d.access_target); }
    if (d.inherit_category_permissions !== undefined) { sets.push("inherit_category_permissions = ?"); vals.push(d.inherit_category_permissions ? 1 : 0); }
    if (d.sort_order !== undefined) { sets.push("sort_order = ?"); vals.push(d.sort_order); }
    if (d.is_locked !== undefined) { sets.push("is_locked = ?"); vals.push(d.is_locked ? 1 : 0); }
    if (d.is_visible !== undefined) { sets.push("is_visible = ?"); vals.push(d.is_visible ? 1 : 0); }
    if (d.topic_template !== undefined) { sets.push("topic_template = ?"); vals.push(d.topic_template); }

    if (sets.length === 0) {
      return NextResponse.json({ success: true });
    }

    vals.push(forumId);
    await dbExecute(`UPDATE panel_forums SET ${sets.join(", ")} WHERE id = ?`, vals);

    await dbExecute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'update_forum', 'forum', ?)`,
      [session.accountId, session.username, forumId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/admin/forums/[id]] PATCH error:", err);
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

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.adminLevel < 1) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const forumId = parseInt(id, 10);
  if (!Number.isFinite(forumId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    interface TopicCountRow extends RowDataPacket { cnt: number }
    const countRow = await dbQuerySingle<TopicCountRow>(
      `SELECT COUNT(*) AS cnt FROM panel_forum_topics WHERE forum_id = ?`,
      [forumId]
    );

    if ((countRow?.cnt ?? 0) > 0) {
      return NextResponse.json({ error: "forum_has_topics" }, { status: 409 });
    }

    await dbExecute(`DELETE FROM panel_forums WHERE id = ?`, [forumId]);

    await dbExecute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'delete_forum', 'forum', ?)`,
      [session.accountId, session.username, forumId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/admin/forums/[id]] DELETE error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
