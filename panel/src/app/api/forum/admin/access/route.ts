import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const RuleSchema = z.object({
  principal_type: z.enum(["everyone", "authenticated", "account", "faction", "clan", "staff", "admin", "helper"]),
  principal_id: z.string().max(64).default(""),
  effect: z.enum(["allow", "deny"]).default("allow"),
  minimum_rank: z.number().int().min(0).nullable().optional(),
  minimum_staff_level: z.number().int().min(1).nullable().optional(),
  can_view: z.boolean().default(true),
  can_create_topic: z.boolean().default(true),
  can_reply: z.boolean().default(true),
  can_edit_own: z.boolean().default(true),
  can_delete_own: z.boolean().default(true),
  can_moderate: z.boolean().default(false),
  can_manage: z.boolean().default(false),
});

const ReplaceSchema = z.object({
  scope_type: z.enum(["category", "forum"]),
  scope_id: z.number().int().positive(),
  rules: z.array(RuleSchema).max(50),
});

async function requireAdmin() {
  const session = await getCurrentSession();
  return session && session.adminLevel >= 1 ? session : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const [categories, forums, clans, rules] = await Promise.all([
      dbQuery<RowDataPacket>("SELECT * FROM panel_forum_categories ORDER BY sort_order, id"),
      dbQuery<RowDataPacket>("SELECT * FROM panel_forums ORDER BY category_id, sort_order, id"),
      dbQuery<RowDataPacket>("SELECT id, name, tag FROM clans ORDER BY name"),
      dbQuery<RowDataPacket>("SELECT * FROM panel_forum_access_rules ORDER BY scope_type, scope_id, id"),
    ]);
    return NextResponse.json({
      categories,
      forums,
      clans,
      factions: Object.values(CANONICAL_FACTIONS).map(({ id, label }) => ({ id, label })),
      rules,
    });
  } catch (error) {
    console.error("[forum/admin/access] GET error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = ReplaceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  const { scope_type, scope_id, rules } = parsed.data;

  const scopeTable = scope_type === "forum" ? "panel_forums" : "panel_forum_categories";
  const scope = await dbQuerySingle<RowDataPacket>(`SELECT id FROM ${scopeTable} WHERE id = ? LIMIT 1`, [scope_id]);
  if (!scope) return NextResponse.json({ error: "not_found" }, { status: 404 });

  for (const rule of rules) {
    if (rule.principal_type === "faction" && !CANONICAL_FACTIONS[rule.principal_id.toLowerCase()]) {
      return NextResponse.json({ error: "invalid_faction" }, { status: 422 });
    }
    if (rule.principal_type === "clan") {
      const clan = await dbQuerySingle<RowDataPacket>("SELECT id FROM clans WHERE id = ? LIMIT 1", [Number(rule.principal_id)]);
      if (!clan) return NextResponse.json({ error: "invalid_clan" }, { status: 422 });
    }
  }

  await dbTransaction(async (conn) => {
    await conn.execute("DELETE FROM panel_forum_access_rules WHERE scope_type = ? AND scope_id = ?", [scope_type, scope_id]);
    for (const rule of rules) {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO panel_forum_access_rules
          (scope_type, scope_id, principal_type, principal_id, effect, minimum_rank, minimum_staff_level,
           can_view, can_create_topic, can_reply, can_edit_own, can_delete_own, can_moderate, can_manage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [scope_type, scope_id, rule.principal_type, rule.principal_id, rule.effect,
         rule.minimum_rank ?? null, rule.minimum_staff_level ?? null,
         rule.can_view ? 1 : 0, rule.can_create_topic ? 1 : 0, rule.can_reply ? 1 : 0,
         rule.can_edit_own ? 1 : 0, rule.can_delete_own ? 1 : 0,
         rule.can_moderate ? 1 : 0, rule.can_manage ? 1 : 0]
      );
    }
    await conn.execute(
      `INSERT INTO panel_forum_modlog (actor_account_id, actor_username, action, target_type, target_id)
       VALUES (?, ?, 'replace_access_rules', ?, ?)`,
      [session.accountId, session.username, scope_type, scope_id]
    );
  });
  return NextResponse.json({ success: true });
}
