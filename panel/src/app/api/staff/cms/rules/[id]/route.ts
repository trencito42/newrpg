import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchRuleSchema = z.object({
  section_id: z.number().int().positive().optional(),
  rule_number: z.string().min(1).max(16).optional(),
  title_en: z.string().min(2).max(255).optional(),
  title_ro: z.string().min(2).max(255).optional(),
  description_en: z.string().min(1).optional(),
  description_ro: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  const ruleId = parseInt((await params).id, 10);
  if (!Number.isFinite(ruleId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  interface RuleRow extends RowDataPacket { id: number }
  const existing = await dbQuerySingle<RuleRow>(
    `SELECT id FROM panel_rules WHERE id = ? LIMIT 1`,
    [ruleId]
  );
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const d = parsed.data;
  const sets: string[] = ["updated_by_account_id = ?"];
  const vals: unknown[] = [auth.accountId];

  if (d.section_id !== undefined) {
    interface SecRow extends RowDataPacket { id: number }
    const section = await dbQuerySingle<SecRow>(
      `SELECT id FROM panel_rule_sections WHERE id = ? LIMIT 1`,
      [d.section_id]
    );
    if (!section) return NextResponse.json({ error: "section_not_found" }, { status: 404 });
    sets.push("section_id = ?");
    vals.push(d.section_id);
  }
  if (d.rule_number !== undefined) { sets.push("rule_number = ?"); vals.push(d.rule_number); }
  if (d.title_en !== undefined) { sets.push("title_en = ?"); vals.push(d.title_en); }
  if (d.title_ro !== undefined) { sets.push("title_ro = ?"); vals.push(d.title_ro); }
  if (d.description_en !== undefined) { sets.push("description_en = ?"); vals.push(d.description_en); }
  if (d.description_ro !== undefined) { sets.push("description_ro = ?"); vals.push(d.description_ro); }
  if (d.sort_order !== undefined) { sets.push("sort_order = ?"); vals.push(d.sort_order); }
  if (d.is_visible !== undefined) { sets.push("is_visible = ?"); vals.push(d.is_visible ? 1 : 0); }

  if (sets.length <= 1) {
    return NextResponse.json({ success: true });
  }

  try {
    vals.push(ruleId);
    await dbExecute(`UPDATE panel_rules SET ${sets.join(", ")} WHERE id = ?`, vals);
    await writeCmsAudit(auth, "cms_rule_update", "rule", ruleId, d);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[staff/cms/rules/[id]] PATCH", err);
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

  const ruleId = parseInt((await params).id, 10);
  if (!Number.isFinite(ruleId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const result = await dbExecute(`DELETE FROM panel_rules WHERE id = ?`, [ruleId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await writeCmsAudit(auth, "cms_rule_delete", "rule", ruleId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[staff/cms/rules/[id]] DELETE", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
