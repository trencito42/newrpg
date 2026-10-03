import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbTransaction, dbQuery } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";
import crypto from "crypto";
import { getFactionAccess } from "@/lib/faction-access";
import { getFactionApplicationAccess } from "@/lib/progression-access";

interface Context {
  params: Promise<{ type: string; id: string; appId: string }>;
}

const reviewSchema = z.object({
  decision: z.enum(["accepted", "rejected", "accepted_add_member", "under_review", "withdrawn"]),
  reason: z.string().trim().max(255).optional(),
});

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId, appId: appIdStr } = await params;
  const appId = Number(appIdStr);
  if (!Number.isSafeInteger(appId) || appId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const app = await dbQuerySingle<RowDataPacket>(
    `SELECT a.*, acc.username as applicant_username
     FROM panel_org_applications a
     JOIN accounts acc ON acc.id = a.account_id
     WHERE a.id = ? AND a.org_type = ? AND a.org_id = ? LIMIT 1`,
    [appId, type, orgId]
  );

  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // If not staff/leader, applicant can only view their own
  let canManage = session.adminLevel >= 3;
  if (!canManage) {
    if (type === "faction") {
      const leaderRow = await getFactionAccess(session.accountId, orgId);
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

  if (!canManage && app.account_id !== session.accountId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Fetch answers with questions
  const answers = await dbQuery<RowDataPacket>(
    `SELECT ans.id, ans.question_id, ans.answer_text, q.label_en, q.label_ro, q.question_type, q.sort_order
     FROM panel_org_application_answers ans
     JOIN panel_org_application_questions q ON q.id = ans.question_id
     WHERE ans.application_id = ?
     ORDER BY q.sort_order ASC`,
    [appId]
  );

  // Fetch reviews history
  const reviews = await dbQuery<RowDataPacket>(
    `SELECT r.id, r.decision, r.reason, r.created_at, acc.username as reviewer_username
     FROM panel_org_application_reviews r
     JOIN accounts acc ON acc.id = r.reviewer_account_id
     WHERE r.application_id = ?
     ORDER BY r.created_at DESC`,
    [appId]
  );

  return NextResponse.json({ application: app, answers, reviews, canManage });
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { type, id: orgId, appId: appIdStr } = await params;
  const appId = Number(appIdStr);
  if (!Number.isSafeInteger(appId) || appId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const { decision, reason } = parsed.data;

  // Verify application exists
  const app = await dbQuerySingle<RowDataPacket>(
    `SELECT * FROM panel_org_applications WHERE id = ? AND org_type = ? AND org_id = ? LIMIT 1`,
    [appId, type, orgId]
  );
  if (!app) {
    return NextResponse.json({ error: "application_not_found" }, { status: 404 });
  }

  // Handling player withdrawal: applicant can withdraw pending application
  if (decision === "withdrawn") {
    if (app.account_id !== session.accountId && session.adminLevel < 4) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (app.status !== "submitted" && app.status !== "under_review") {
      return NextResponse.json({ error: "cannot_withdraw_resolved_application" }, { status: 400 });
    }
    await dbTransaction(async (conn) => {
      await conn.execute(
        `UPDATE panel_org_applications SET status = 'withdrawn', updated_at = NOW() WHERE id = ?`,
        [appId]
      );
      await conn.execute(
        `INSERT INTO panel_org_application_reviews (application_id, reviewer_account_id, decision, reason)
         VALUES (?, ?, 'withdrawn', ?)`,
        [appId, session.accountId, reason || "Withdrawn by applicant"]
      );
    });
    return NextResponse.json({ success: true, status: "withdrawn" });
  }

  // Review permissions check
  let canReview = session.adminLevel >= 3;
  if (!canReview) {
    if (type === "faction") {
      const leaderRow = await getFactionAccess(session.accountId, orgId);
      if (leaderRow && (Number(leaderRow.job_grade) >= 6 || Boolean(leaderRow.is_leader))) {
        canReview = true;
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
        canReview = true;
      }
    }
  }

  if (!canReview) {
    return NextResponse.json({ error: "forbidden_insufficient_rank" }, { status: 403 });
  }

  if (app.status === "accepted" || app.status === "rejected" || app.status === "withdrawn") {
    return NextResponse.json({ error: "application_already_resolved" }, { status: 400 });
  }

  // Leaders cannot use the panel action queue to bypass canonical faction progression.
  // Admin level 3+ is the only explicit operational bypass.
  if (type === "faction" && decision === "accepted_add_member" && session.adminLevel < 3) {
    const access = await getFactionApplicationAccess(Number(app.character_id));
    if (!access.allowed) {
      return NextResponse.json(access, { status: access.error === "character_not_found" ? 404 : 400 });
    }
  }

  const finalStatus = decision === "accepted_add_member" || decision === "accepted" ? "accepted" : (decision === "under_review" ? "under_review" : "rejected");

  await dbTransaction(async (conn) => {
    await conn.execute(
      `UPDATE panel_org_applications 
       SET status = ?, review_reason = ?, reviewed_by_account_id = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [finalStatus, reason || null, session.accountId, appId]
    );

    await conn.execute(
      `INSERT INTO panel_org_application_reviews (application_id, reviewer_account_id, decision, reason)
       VALUES (?, ?, ?, ?)`,
      [appId, session.accountId, decision, reason || null]
    );

    // Add system decision comment to application thread
    const decisionPost = `[APPLICATION ${finalStatus.toUpperCase()}]\nDecision by: ${session.username}\nReason: ${reason || "No specific reason provided."}`;
    await conn.execute(
      `INSERT INTO panel_org_application_comments 
        (application_id, org_type, org_id, sender_account_id, sender_character_id, sender_username, role_badge, message)
       VALUES (?, ?, ?, ?, ?, ?, 'DECISION', ?)`,
      [appId, type, orgId, session.accountId, session.selectedCharacterId || null, session.username, decisionPost]
    );

    // Create notification for applicant
    const orgLabel = type === "faction" ? `Faction ${orgId}` : `Clan ${orgId}`;
    const notifTitleEn = `Application ${finalStatus.toUpperCase()}`;
    const notifTitleRo = `Aplicație ${finalStatus === "accepted" ? "ACCEPTATĂ" : "RESPINSĂ"}`;
    const notifMsgEn = `Your application for ${orgLabel} was marked as ${finalStatus}. ${reason ? `Reason: ${reason}` : ""}`;
    const notifMsgRo = `Aplicația ta pentru ${orgLabel} a fost ${finalStatus === "accepted" ? "acceptată" : "respinsă"}. ${reason ? `Motiv: ${reason}` : ""}`;

    await conn.execute(
      `INSERT INTO panel_notifications (account_id, type, title_en, title_ro, message_en, message_ro, link_url)
       VALUES (?, 'application_decision', ?, ?, ?, ?, ?)`,
      [app.account_id, notifTitleEn, notifTitleRo, notifMsgEn, notifMsgRo, `/${type === "faction" ? "factions" : "clans"}/${orgId}/applications/${appId}`]
    );

    // If accepted and add member requested, queue the domain action!
    if (decision === "accepted_add_member") {
      const requestId = crypto.randomUUID();
      const actionName = type === "faction" ? "faction_set_member" : "clan_add_member";
      const payload = JSON.stringify(
        type === "faction"
          ? { factionId: orgId, factionGrade: 1 }
          : { clanId: Number(orgId), rank: 1 }
      );

      await conn.execute(
        `INSERT INTO panel_action_queue 
          (request_id, actor_account_id, actor_character_id, action, target_account_id, target_character_id, payload_json, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
          session.accountId,
          session.selectedCharacterId,
          actionName,
          app.account_id,
          app.character_id,
          payload,
          `Application #${appId} accepted and admitted`,
        ]
      );
    }
  });

  return NextResponse.json({ success: true, status: finalStatus });
}
