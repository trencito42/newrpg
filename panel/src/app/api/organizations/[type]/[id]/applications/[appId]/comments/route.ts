import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";
import { getFactionAccess } from "@/lib/faction-access";
import { t } from "@/lib/i18n";


interface Context {
  params: Promise<{ type: string; id: string; appId: string }>;
}

const commentSchema = z.object({
  message: z.string().trim().min(2, "Comment too short").max(5000, "Comment too long"),
});

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId, appId: appIdStr } = await params;
  const appId = Number(appIdStr);
  if (!Number.isSafeInteger(appId) || appId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const comments = await dbQuery<RowDataPacket>(
    `SELECT 
       c.id, c.application_id, c.org_type, c.org_id, c.sender_account_id,
       c.sender_character_id, c.sender_username, c.role_badge, c.message, c.created_at
     FROM panel_org_application_comments c
     WHERE c.application_id = ? AND c.org_type = ? AND c.org_id = ?
     ORDER BY c.created_at ASC, c.id ASC`,
    [appId, type, orgId]
  );

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: Context) {
  const locale = await getViewerLocale();
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { type, id: orgId, appId: appIdStr } = await params;
  const appId = Number(appIdStr);
  if (!Number.isSafeInteger(appId) || appId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
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

  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  // 1. Fetch application
  const app = await dbQuerySingle<RowDataPacket>(
    `SELECT id, org_type, org_id, account_id, character_id, status 
     FROM panel_org_applications 
     WHERE id = ? AND org_type = ? AND org_id = ? LIMIT 1`,
    [appId, type, orgId]
  );

  if (!app) {
    return NextResponse.json({ error: "application_not_found" }, { status: 404 });
  }

  const isApplicant = app.account_id === session.accountId;
  const isStaff = session.adminLevel >= 1 || session.helperLevel >= 1;
  const isResolved = app.status === "accepted" || app.status === "rejected" || app.status === "withdrawn";

  // 2. Check membership & role in the organization
  let isMember = false;
  let isLeader = false;
  let isSubLeader = false;
  let memberCharacterId: number | null = session.selectedCharacterId || null;

  if (type === "faction") {
    const memberRow = await getFactionAccess(session.accountId, orgId);

    if (memberRow) {
      isMember = true;
      memberCharacterId = memberRow.id;
      if (Boolean(memberRow.is_leader) || Number(memberRow.job_grade) >= 7) {
        isLeader = true;
      } else if (Number(memberRow.job_grade) >= 6) {
        isSubLeader = true;
      }
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

    if (clanRow) {
      isMember = true;
      memberCharacterId = clanRow.char_id;
      if (Number(clanRow.rank) >= 6 || Number(clanRow.owner_character_id) === Number(clanRow.char_id)) {
        isLeader = true;
      } else if (Number(clanRow.rank) >= 5) {
        isSubLeader = true;
      }
    }
  }

  // 3. Permission check:
  // Allowed if:
  // - Staff
  // - Verified member of that exact org
  // - Applicant (if application is still pending!)
  if (!isStaff && !isMember && !isApplicant) {
    return NextResponse.json(
      { error: "forbidden", message: t(locale, "interface.you_do_not_have_permission_to_comment_on_this_application") },
      { status: 403 }
    );
  }

  // If application is finalized, only staff or leadership can reply
  if (isResolved && !isStaff && !isLeader && !isSubLeader) {
    return NextResponse.json(
      { error: "thread_locked", message: t(locale, "interface.this_application_is_closed") },
      { status: 400 }
    );
  }

  // 4. Determine role badge
  let roleBadge = "MEMBER";
  if (session.adminLevel >= 1) {
    roleBadge = `ADMIN ${session.adminLevel}`;
  } else if (session.helperLevel >= 1) {
    roleBadge = `HELPER ${session.helperLevel}`;
  } else if (isLeader) {
    roleBadge = "LEADER";
  } else if (isSubLeader) {
    roleBadge = "CO-LEADER";
  } else if (isApplicant) {
    roleBadge = "APPLICANT";
  }

  // 5. Insert comment
  const insertRes = await dbExecute(
    `INSERT INTO panel_org_application_comments 
      (application_id, org_type, org_id, sender_account_id, sender_character_id, sender_username, role_badge, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      appId,
      type,
      orgId,
      session.accountId,
      memberCharacterId,
      session.username,
      roleBadge,
      parsed.data.message,
    ]
  );

  // 6. Notify applicant if someone else commented, or notify leader if applicant commented
  const orgLabel = type === "faction" ? `Faction ${orgId}` : `Clan ${orgId}`;
  if (!isApplicant && app.account_id) {
    await createNotification({
      accountId: app.account_id,
      type: "application_comment",
      titleEn: `New Comment on Your ${orgLabel} Application`,
      titleRo: `Comentariu nou la aplicația ta (${orgLabel})`,
      messageEn: `${session.username} [${roleBadge}] commented on your application #${appId}.`,
      messageRo: `${session.username} [${roleBadge}] a lăsat un comentariu la aplicația ta #${appId}.`,
      linkUrl: `/${type === "faction" ? "factions" : "clans"}/${orgId}/applications/${appId}`,
    });
  }

  return NextResponse.json({
    success: true,
    commentId: insertRes.insertId,
    roleBadge,
    senderUsername: session.username,
  }, { status: 201 });
}
