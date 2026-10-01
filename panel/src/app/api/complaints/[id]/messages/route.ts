import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

interface Context {
  params: Promise<{ id: string }>;
}

const messageSchema = z.object({
  message: z.string().trim().min(2, "Message too short").max(5000, "Message too long"),
});

export async function POST(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { id } = await params;
  const complaintId = Number(id);
  if (!Number.isSafeInteger(complaintId) || complaintId < 1) {
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

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  // Fetch complaint details to evaluate permissions
  const complaint = await dbQuerySingle<RowDataPacket>(
    `SELECT 
       c.id, c.accuser_account_id, c.accused_character_id, c.status, c.handled_by_account_id,
       p_accused.account_id AS accused_account_id
     FROM panel_complaints c
     LEFT JOIN characters char_accused ON char_accused.id = c.accused_character_id
     LEFT JOIN players p_accused ON p_accused.id = char_accused.player_id
     WHERE c.id = ?
     LIMIT 1`,
    [complaintId]
  );

  if (!complaint) {
    return NextResponse.json({ error: "complaint_not_found" }, { status: 404 });
  }

  const isReporter = session.accountId === complaint.accuser_account_id;
  const isAccused = session.accountId === complaint.accused_account_id;
  const isStaff = session.adminLevel >= 1 || session.helperLevel >= 1;

  // Enforce server-side permissions: Only reporter, reported player, or authorized staff may reply
  if (!isReporter && !isAccused && !isStaff) {
    return NextResponse.json(
      { error: "forbidden_not_involved", message: "Only the reporter, reported player, and authorized staff may reply to this complaint." },
      { status: 403 }
    );
  }

  // Check locked status: if finalized, non-staff cannot reply
  const isLocked = complaint.status === "action_taken" || complaint.status === "dismissed";
  if (isLocked && !isStaff) {
    return NextResponse.json(
      { error: "complaint_locked", message: "This complaint is closed and no longer accepts replies." },
      { status: 400 }
    );
  }

  // Determine role badge
  let roleBadge = "USER";
  if (session.adminLevel >= 1) {
    roleBadge = `ADMIN ${session.adminLevel}`;
  } else if (session.helperLevel >= 1) {
    roleBadge = `HELPER ${session.helperLevel}`;
  } else if (isReporter) {
    roleBadge = "REPORTER";
  } else if (isAccused) {
    roleBadge = "REPORTED PLAYER";
  }

  // Insert message into panel_complaint_messages
  const insertRes = await dbExecute(
    `INSERT INTO panel_complaint_messages 
      (complaint_id, sender_account_id, sender_character_id, is_staff, role_badge, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      complaintId,
      session.accountId,
      session.selectedCharacterId || null,
      isStaff ? 1 : 0,
      roleBadge,
      parsed.data.message,
    ]
  );

  // Update complaint updated_at timestamp
  await dbExecute(
    `UPDATE panel_complaints SET updated_at = NOW() WHERE id = ?`,
    [complaintId]
  );

  // Dispatch notifications to the other parties
  const notificationTargets = new Set<number>();
  if (complaint.accuser_account_id && complaint.accuser_account_id !== session.accountId) {
    notificationTargets.add(complaint.accuser_account_id);
  }
  if (complaint.accused_account_id && complaint.accused_account_id !== session.accountId) {
    notificationTargets.add(complaint.accused_account_id);
  }
  if (complaint.handled_by_account_id && complaint.handled_by_account_id !== session.accountId) {
    notificationTargets.add(complaint.handled_by_account_id);
  }

  for (const targetAccountId of notificationTargets) {
    await createNotification({
      accountId: targetAccountId,
      type: "complaint_reply",
      titleEn: `New Reply on Complaint #${complaintId}`,
      titleRo: `Răspuns nou la Reclamația #${complaintId}`,
      messageEn: `${session.username} (${roleBadge}) posted a reply on Complaint #${complaintId}.`,
      messageRo: `${session.username} (${roleBadge}) a lăsat un răspuns la Reclamația #${complaintId}.`,
      linkUrl: `/support/complaints/${complaintId}`,
    });
  }

  return NextResponse.json({
    success: true,
    messageId: insertRes.insertId,
    roleBadge,
    senderUsername: session.username,
  }, { status: 201 });
}
