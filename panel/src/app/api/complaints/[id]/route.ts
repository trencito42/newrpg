import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { RowDataPacket } from "mysql2";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Context) {
  const { id } = await params;
  const complaintId = Number(id);
  if (!Number.isSafeInteger(complaintId) || complaintId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const session = await getCurrentSession();

  // Fetch complaint details
  const complaint = await dbQuerySingle<RowDataPacket>(
    `SELECT 
       c.id, c.accuser_account_id, c.accuser_character_id, c.accused_character_id, c.accused_name,
       c.category, c.title, c.evidence_text, c.status, c.verdict, c.handled_by_account_id,
       c.created_at, c.updated_at,
       acc_user.username AS accuser_username,
       acc_handler.username AS handler_username,
       char_accuser.level AS accuser_level,
       char_accused.level AS accused_level,
       p_accused.account_id AS accused_account_id
     FROM panel_complaints c
     LEFT JOIN accounts acc_user ON acc_user.id = c.accuser_account_id
     LEFT JOIN accounts acc_handler ON acc_handler.id = c.handled_by_account_id
     LEFT JOIN characters char_accuser ON char_accuser.id = c.accuser_character_id
     LEFT JOIN characters char_accused ON char_accused.id = c.accused_character_id
     LEFT JOIN players p_accused ON p_accused.id = char_accused.player_id
     WHERE c.id = ?
     LIMIT 1`,
    [complaintId]
  );

  if (!complaint) {
    return NextResponse.json({ error: "complaint_not_found" }, { status: 404 });
  }

  // Fetch messages thread
  const messages = await dbQuery<RowDataPacket>(
    `SELECT 
       m.id, m.complaint_id, m.sender_account_id, m.sender_character_id,
       m.is_staff, m.role_badge, m.message, m.created_at,
       a.username AS sender_username
     FROM panel_complaint_messages m
     LEFT JOIN accounts a ON a.id = m.sender_account_id
     WHERE m.complaint_id = ?
     ORDER BY m.created_at ASC, m.id ASC`,
    [complaintId]
  );

  // Collect all usernames to batch-resolve PlayerIdentity
  const usernamesToResolve = new Set<string>();
  if (complaint.accuser_username) usernamesToResolve.add(complaint.accuser_username);
  if (complaint.accused_name) usernamesToResolve.add(complaint.accused_name);
  if (complaint.handler_username) usernamesToResolve.add(complaint.handler_username);
  for (const m of messages) {
    if (m.sender_username) usernamesToResolve.add(m.sender_username);
  }

  const identitiesMap = await resolvePlayerIdentities(Array.from(usernamesToResolve));
  const identitiesObj = Object.fromEntries(identitiesMap);

  // Calculate viewer permissions
  const isReporter = Boolean(session && session.accountId === complaint.accuser_account_id);
  const isAccused = Boolean(session && session.accountId === complaint.accused_account_id);
  const isStaff = Boolean(session && (session.adminLevel >= 1 || session.helperLevel >= 1));
  const isLocked = complaint.status === "action_taken" || complaint.status === "dismissed";
  const canReply = Boolean(session && (isReporter || isAccused || isStaff) && (!isLocked || isStaff));
  const canManage = isStaff;

  return NextResponse.json({
    complaint,
    messages,
    identities: identitiesObj,
    viewer: {
      isLoggedIn: Boolean(session),
      isReporter,
      isAccused,
      isStaff,
      isLocked,
      canReply,
      canManage,
    },
  });
}
