import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

interface Context {
  params: Promise<{ type: string; id: string }>;
}

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.number().int().positive(),
      answerText: z.string().trim().min(1).max(2000),
    })
  ),
});

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId } = await params;
  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Check viewer permissions
  let canManage = session.adminLevel >= 3;
  if (!canManage) {
    if (type === "faction") {
      const leaderRow = await dbQuerySingle<RowDataPacket>(
        `SELECT c.job, c.job_grade, fl.id as is_leader
         FROM characters c
         JOIN players p ON p.id = c.player_id
         LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
         WHERE p.account_id = ? AND c.job = ? LIMIT 1`,
        [orgId, session.accountId, orgId]
      );
      if (leaderRow && (Number(leaderRow.job_grade) >= 6 || Boolean(leaderRow.is_leader))) {
        canManage = true;
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
      if (clanRow && (Number(clanRow.rank) >= 6 || Number(clanRow.owner_character_id) === Number(clanRow.char_id))) {
        canManage = true;
      }
    }
  }

  if (canManage) {
    // Return all applications for this organization
    const apps = await dbQuery<RowDataPacket>(
      `SELECT 
        a.id, a.org_type, a.org_id, a.account_id, a.character_id, a.status,
        a.review_reason, a.reviewed_by_account_id, a.reviewed_at, a.snapshot_json,
        a.created_at, a.updated_at,
        acc.username as applicant_username,
        rev.username as reviewer_username
       FROM panel_org_applications a
       JOIN accounts acc ON acc.id = a.account_id
       LEFT JOIN accounts rev ON rev.id = a.reviewed_by_account_id
       WHERE a.org_type = ? AND a.org_id = ?
       ORDER BY FIELD(a.status, 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'archived'), a.created_at DESC`,
      [type, orgId]
    );

    return NextResponse.json({ canManage: true, applications: apps });
  }

  // Regular user: return their own applications only
  const userApps = await dbQuery<RowDataPacket>(
    `SELECT 
      a.id, a.org_type, a.org_id, a.account_id, a.character_id, a.status,
      a.review_reason, a.reviewed_at, a.created_at, a.updated_at,
      acc.username as applicant_username
     FROM panel_org_applications a
     JOIN accounts acc ON acc.id = a.account_id
     WHERE a.org_type = ? AND a.org_id = ? AND a.account_id = ?
     ORDER BY a.created_at DESC`,
    [type, orgId, session.accountId]
  );

  return NextResponse.json({ canManage: false, applications: userApps });
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
  if (!session || !session.selectedCharacterId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. Check if applications are open
  const settings = await dbQuerySingle<RowDataPacket>(
    `SELECT applications_open, min_level, min_hours, max_warnings, cooldown_hours
     FROM panel_org_application_settings
     WHERE org_type = ? AND org_id = ? LIMIT 1`,
    [type, orgId]
  );

  if (!settings || !settings.applications_open) {
    return NextResponse.json({ error: "applications_closed" }, { status: 400 });
  }

  // 2. Fetch applicant character details
  const character = await dbQuerySingle<RowDataPacket>(
    `SELECT c.id, c.level, c.job, c.paydays_received, p.license
     FROM characters c
     JOIN players p ON p.id = c.player_id
     WHERE c.id = ? AND p.account_id = ? LIMIT 1`,
    [session.selectedCharacterId, session.accountId]
  );

  if (!character) {
    return NextResponse.json({ error: "character_not_found" }, { status: 404 });
  }

  // 3. Eligibility checks
  if (type === "faction" && character.job && character.job !== "unemployed" && character.job !== "civ") {
    return NextResponse.json({ error: "already_in_faction" }, { status: 400 });
  }

  if (Number(character.level) < Number(settings.min_level)) {
    return NextResponse.json({ error: "level_too_low", minLevel: settings.min_level }, { status: 400 });
  }

  // Check active warns
  const warns = await dbQuerySingle<RowDataPacket>(
    `SELECT COUNT(*) as count FROM admin_sanctions
     WHERE action = 'warn' AND target_account_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [session.accountId]
  );
  if (Number(warns?.count || 0) > Number(settings.max_warnings)) {
    return NextResponse.json({ error: "too_many_warnings" }, { status: 400 });
  }

  // Check cooldown or existing pending application
  const existing = await dbQuerySingle<RowDataPacket>(
    `SELECT id, status, created_at FROM panel_org_applications
     WHERE org_type = ? AND org_id = ? AND account_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [type, orgId, session.accountId]
  );

  if (existing) {
    if (existing.status === "submitted" || existing.status === "under_review") {
      return NextResponse.json({ error: "pending_application_exists" }, { status: 400 });
    }
    if (existing.status === "rejected") {
      const cooldownHours = Number(settings.cooldown_hours) || 24;
      const cooldownRow = await dbQuerySingle<RowDataPacket>(
        `SELECT (NOW() < DATE_ADD(?, INTERVAL ? HOUR)) AS is_cooling`,
        [existing.created_at, cooldownHours]
      );
      if (cooldownRow?.is_cooling) {
        return NextResponse.json({ error: "application_cooldown", cooldownHours }, { status: 400 });
      }
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const snapshot = JSON.stringify({
    level: character.level,
    hours: character.paydays_received,
    job: character.job,
    warnings: warns?.count || 0,
    appliedAt: new Date().toISOString(),
  });

  const appId = await dbTransaction(async (conn) => {
    const [ins] = await conn.execute<import("mysql2").ResultSetHeader>(
      `INSERT INTO panel_org_applications
        (org_type, org_id, account_id, character_id, status, snapshot_json)
       VALUES (?, ?, ?, ?, 'submitted', ?)`,
      [type, orgId, session.accountId, character.id, snapshot]
    );
    const newId = ins.insertId;

    for (const ans of parsed.data.answers) {
      await conn.execute(
        `INSERT INTO panel_org_application_answers (application_id, question_id, answer_text)
         VALUES (?, ?, ?)`,
        [newId, ans.questionId, ans.answerText]
      );
    }

    return newId;
  });

  return NextResponse.json({ success: true, applicationId: appId }, { status: 201 });
}
