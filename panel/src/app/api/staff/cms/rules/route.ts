import { NextRequest, NextResponse } from "next/server";
import { requireCmsAdminApi } from "@/lib/cms/auth";
import { writeCmsAudit } from "@/lib/cms/audit";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createRuleSchema = z.object({
  section_id: z.number().int().positive(),
  rule_number: z.string().min(1).max(16),
  title_en: z.string().min(2).max(255),
  title_ro: z.string().min(2).max(255),
  description_en: z.string().min(1),
  description_ro: z.string().min(1),
  sort_order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await requireCmsAdminApi();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  interface SecRow extends RowDataPacket { id: number }
  const section = await dbQuerySingle<SecRow>(
    `SELECT id FROM panel_rule_sections WHERE id = ? LIMIT 1`,
    [parsed.data.section_id]
  );
  if (!section) {
    return NextResponse.json({ error: "section_not_found" }, { status: 404 });
  }

  try {
    const result = await dbExecute(
      `INSERT INTO panel_rules
         (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible, updated_by_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parsed.data.section_id,
        parsed.data.rule_number,
        parsed.data.title_en,
        parsed.data.title_ro,
        parsed.data.description_en,
        parsed.data.description_ro,
        parsed.data.sort_order ?? 0,
        parsed.data.is_visible === false ? 0 : 1,
        auth.accountId,
      ]
    );

    await writeCmsAudit(auth, "cms_rule_create", "rule", result.insertId, {
      section_id: parsed.data.section_id,
      rule_number: parsed.data.rule_number,
    });

    return NextResponse.json({ id: result.insertId });
  } catch (err) {
    console.error("[staff/cms/rules] POST", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
