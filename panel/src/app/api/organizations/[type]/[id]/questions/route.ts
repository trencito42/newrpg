import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

interface Context {
  params: Promise<{ type: string; id: string }>;
}

const questionSchema = z.object({
  id: z.number().int().positive().optional(),
  labelEn: z.string().trim().min(3).max(255),
  labelRo: z.string().trim().min(3).max(255),
  questionType: z.enum(["text", "textarea", "boolean", "select"]).default("text"),
  optionsJson: z.string().optional(),
  required: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId } = await params;
  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }

  const questions = await dbQuery<RowDataPacket>(
    `SELECT id, org_type, org_id, label_en, label_ro, question_type, options_json, required, sort_order, active
     FROM panel_org_application_questions
     WHERE org_type = ? AND org_id = ? AND active = 1
     ORDER BY sort_order ASC, id ASC`,
    [type, orgId]
  );

  return NextResponse.json({ questions });
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { type, id: orgId } = await params;
  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Only Leader (R7) or Admin 4+ can create/edit questions
  let isLeader = session.adminLevel >= 4;
  if (!isLeader) {
    if (type === "faction") {
      const leaderRow = await dbQuerySingle<RowDataPacket>(
        `SELECT c.job, c.job_grade, fl.id as is_leader
         FROM characters c
         JOIN players p ON p.id = c.player_id
         LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
         WHERE p.account_id = ? AND c.job = ? LIMIT 1`,
        [orgId, session.accountId, orgId]
      );
      if (leaderRow && (Number(leaderRow.job_grade) >= 7 || Boolean(leaderRow.is_leader))) {
        isLeader = true;
      }
    } else if (type === "clan") {
      const clanRow = await dbQuerySingle<RowDataPacket>(
        `SELECT cm.rank, c.owner_character_id, ch.id as char_id
         FROM clan_members cm
         JOIN characters ch ON ch.id = cm.character_id
         JOIN players p ON p.id = ch.player_id
         JOIN clans c ON c.id = cm.clan_id
         WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
        [session.accountId, orgId]
      );
      if (clanRow && (Number(clanRow.rank) >= 7 || Number(clanRow.owner_character_id) === Number(clanRow.char_id))) {
        isLeader = true;
      }
    }
  }

  if (!isLeader) {
    return NextResponse.json({ error: "forbidden_leader_only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const q = parsed.data;

  if (q.id) {
    await dbQuerySingle(
      `UPDATE panel_org_application_questions
       SET label_en = ?, label_ro = ?, question_type = ?, options_json = ?, required = ?, sort_order = ?, active = ?
       WHERE id = ? AND org_type = ? AND org_id = ?`,
      [q.labelEn, q.labelRo, q.questionType, q.optionsJson || null, q.required ? 1 : 0, q.sortOrder, q.active ? 1 : 0, q.id, type, orgId]
    );
    return NextResponse.json({ success: true, updated: q.id });
  }

  const res = await dbQuerySingle<{ insertId: number }>(
    `INSERT INTO panel_org_application_questions
      (org_type, org_id, label_en, label_ro, question_type, options_json, required, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, orgId, q.labelEn, q.labelRo, q.questionType, q.optionsJson || null, q.required ? 1 : 0, q.sortOrder, q.active ? 1 : 0]
  );

  return NextResponse.json({ success: true, id: res?.insertId });
}

export async function DELETE(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { type, id: orgId } = await params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const questionId = Number(req.nextUrl.searchParams.get("questionId"));
  if (!Number.isSafeInteger(questionId) || questionId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let isLeader = session.adminLevel >= 4;
  if (!isLeader) {
    if (type === "faction") {
      const leaderRow = await dbQuerySingle<RowDataPacket>(
        `SELECT c.job, c.job_grade, fl.id as is_leader
         FROM characters c
         JOIN players p ON p.id = c.player_id
         LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
         WHERE p.account_id = ? AND c.job = ? LIMIT 1`,
        [orgId, session.accountId, orgId]
      );
      if (leaderRow && (Number(leaderRow.job_grade) >= 7 || Boolean(leaderRow.is_leader))) {
        isLeader = true;
      }
    } else if (type === "clan") {
      const clanRow = await dbQuerySingle<RowDataPacket>(
        `SELECT cm.rank, c.owner_character_id, ch.id as char_id
         FROM clan_members cm
         JOIN characters ch ON ch.id = cm.character_id
         JOIN players p ON p.id = ch.player_id
         JOIN clans c ON c.id = cm.clan_id
         WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
        [session.accountId, orgId]
      );
      if (clanRow && (Number(clanRow.rank) >= 7 || Number(clanRow.owner_character_id) === Number(clanRow.char_id))) {
        isLeader = true;
      }
    }
  }

  if (!isLeader) {
    return NextResponse.json({ error: "forbidden_leader_only" }, { status: 403 });
  }

  await dbQuerySingle(
    `UPDATE panel_org_application_questions SET active = 0 WHERE id = ? AND org_type = ? AND org_id = ?`,
    [questionId, type, orgId]
  );

  return NextResponse.json({ success: true, deleted: questionId });
}
