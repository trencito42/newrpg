import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute, dbTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";
import crypto from "crypto";

interface Context {
  params: Promise<{ id: string }>;
}

const statusActionSchema = z.object({
  action: z.enum(["take", "under_review", "request_info", "accept", "dismiss", "close"]),
  reason: z.string().trim().max(500).optional(),
  sanctionType: z.enum(["none", "warn", "mute", "ban"]).optional(),
  sanctionDuration: z.number().int().min(1).max(43200).optional(),
  internalNote: z.string().trim().max(500).optional(),
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

  // Check staff authorization
  if (session.adminLevel < 1 && session.helperLevel < 1) {
    return NextResponse.json({ error: "forbidden_staff_only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = statusActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const { action, reason, sanctionType, sanctionDuration } = parsed.data;

  // Fetch complaint details
  const complaint = await dbQuerySingle<RowDataPacket>(
    `SELECT 
       c.id, c.accuser_account_id, c.accused_character_id, c.accused_name, c.status, c.handled_by_account_id,
       p_accused.account_id AS accused_account_id,
       char_accused.firstname AS accused_fn,
       char_accused.lastname AS accused_ln
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
  if ((complaint.status === "action_taken" || complaint.status === "dismissed") && action !== "close") {
    return NextResponse.json({ error: "complaint_already_finalized" }, { status: 409 });
  }

  const staffBadge = session.adminLevel >= 1 ? `Admin ${session.adminLevel}` : `Helper ${session.helperLevel}`;

  if (action === "take") {
    await dbTransaction(async (conn) => {
      await conn.execute(
        `UPDATE panel_complaints 
         SET status = 'under_review', handled_by_account_id = ?, updated_at = NOW() 
         WHERE id = ?`,
        [session.accountId, complaintId]
      );

      const sysMessage = `[STAFF ACTION] Complaint assigned to and taken by ${session.username} [${staffBadge}].`;
      await conn.execute(
        `INSERT INTO panel_complaint_messages 
          (complaint_id, sender_account_id, sender_character_id, is_staff, role_badge, message)
         VALUES (?, ?, ?, 1, 'STAFF', ?)`,
        [complaintId, session.accountId, session.selectedCharacterId || null, sysMessage]
      );
    });

    if (complaint.accuser_account_id) {
      await createNotification({
        accountId: complaint.accuser_account_id,
        type: "complaint_taken",
        titleEn: `Complaint #${complaintId} Taken`,
        titleRo: `Reclamația #${complaintId} a fost preluată`,
        messageEn: `Your complaint #${complaintId} is now under review by ${session.username} [${staffBadge}].`,
        messageRo: `Reclamația ta #${complaintId} este revizuită de ${session.username} [${staffBadge}].`,
        linkUrl: `/support/complaints/${complaintId}`,
      });
    }

    return NextResponse.json({ success: true, status: "under_review", handledBy: session.username });
  }

  if (action === "under_review") {
    await dbExecute(
      `UPDATE panel_complaints SET status = 'under_review', updated_at = NOW() WHERE id = ?`,
      [complaintId]
    );

    if (reason) {
      await dbExecute(
        `INSERT INTO panel_complaint_messages 
          (complaint_id, sender_account_id, sender_character_id, is_staff, role_badge, message)
         VALUES (?, ?, ?, 1, 'STAFF', ?)`,
        [complaintId, session.accountId, session.selectedCharacterId || null, `[STAFF NOTE] ${reason}`]
      );
    }

    return NextResponse.json({ success: true, status: "under_review" });
  }

  if (action === "request_info") {
    const infoMessage = `[REQUEST FOR INFORMATION] ${session.username} [${staffBadge}] requested more information:\n${reason || "Please provide further evidence or clarification regarding this incident."}`;
    await dbExecute(
      `INSERT INTO panel_complaint_messages 
        (complaint_id, sender_account_id, sender_character_id, is_staff, role_badge, message)
       VALUES (?, ?, ?, 1, 'STAFF', ?)`,
      [complaintId, session.accountId, session.selectedCharacterId || null, infoMessage]
    );

    if (complaint.accuser_account_id) {
      await createNotification({
        accountId: complaint.accuser_account_id,
        type: "complaint_info_requested",
        titleEn: `Information Requested on Complaint #${complaintId}`,
        titleRo: `Clarificări solicitate la Reclamația #${complaintId}`,
        messageEn: `Staff requested additional information on Complaint #${complaintId}.`,
        messageRo: `Staff-ul a solicitat informații suplimentare pentru Reclamația #${complaintId}.`,
        linkUrl: `/support/complaints/${complaintId}`,
      });
    }
    if (complaint.accused_account_id) {
      await createNotification({
        accountId: complaint.accused_account_id,
        type: "complaint_info_requested",
        titleEn: `Information Requested on Complaint #${complaintId}`,
        titleRo: `Clarificări solicitate la Reclamația #${complaintId}`,
        messageEn: `Staff requested clarification on Complaint #${complaintId}.`,
        messageRo: `Staff-ul a solicitat clarificări pentru Reclamația #${complaintId}.`,
        linkUrl: `/support/complaints/${complaintId}`,
      });
    }

    return NextResponse.json({ success: true });
  }

  if (action === "accept") {
    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: "reason_required", message: "A clear reason/verdict is required to accept a complaint." }, { status: 400 });
    }

    const queueSanction = sanctionType && sanctionType !== "none";
    if (queueSanction) {
      const minimumLevel = sanctionType === "ban" ? 2 : 1;
      if (session.adminLevel < minimumLevel) {
        return NextResponse.json({ error: "forbidden_sanction" }, { status: 403 });
      }
      if (!complaint.accused_account_id) {
        return NextResponse.json({ error: "invalid_sanction_target" }, { status: 400 });
      }
      if (sanctionType === "mute" && !sanctionDuration) {
        return NextResponse.json({ error: "duration_required" }, { status: 400 });
      }
    }

    let sanctionSummary = "";
    if (queueSanction) {
      sanctionSummary = `Staff action requested: ${sanctionType.toUpperCase()}${sanctionDuration ? ` (${sanctionDuration} minutes)` : ""}; awaiting FiveM result`;
    }

    const finalVerdictText = sanctionSummary ? `${reason} | ${sanctionSummary}` : reason;

    const accepted = await dbTransaction(async (conn) => {
      const [updated] = await conn.execute<import("mysql2").ResultSetHeader>(
        `UPDATE panel_complaints 
         SET status = 'action_taken', verdict = ?, handled_by_account_id = ?, updated_at = NOW() 
         WHERE id = ? AND status IN ('pending', 'under_review')`,
        [finalVerdictText, session.accountId, complaintId]
      );
      if (updated.affectedRows !== 1) return false;

      const decisionMsg = `[COMPLAINT ACCEPTED]\nHandled by: ${session.username} [${staffBadge}]\nReason: ${reason}${sanctionSummary ? `\n${sanctionSummary}` : ""}`;
      await conn.execute(
        `INSERT INTO panel_complaint_messages 
          (complaint_id, sender_account_id, sender_character_id, is_staff, role_badge, message)
         VALUES (?, ?, ?, 1, 'STAFF', ?)`,
        [complaintId, session.accountId, session.selectedCharacterId || null, decisionMsg]
      );

      // Request execution in FiveM; the complaint verdict does not imply success.
      if (queueSanction) {
        const requestId = crypto.randomUUID();
        const payloadJson = JSON.stringify({
          durationMin: sanctionDuration || null,
          reason: `Complaint #${complaintId}: ${reason}`.slice(0, 255),
        });

        await conn.execute(
          `INSERT INTO panel_action_queue 
            (request_id, actor_account_id, actor_character_id, action, target_account_id, target_character_id, payload_json, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            requestId,
            session.accountId,
            session.selectedCharacterId,
            sanctionType,
            complaint.accused_account_id,
            complaint.accused_character_id,
            payloadJson,
            `Complaint #${complaintId} accepted: ${reason}`.slice(0, 255),
          ]
        );
      }
      return true;
    });
    if (!accepted) return NextResponse.json({ error: "complaint_already_finalized" }, { status: 409 });

    // Send notifications to reporter and reported player
    if (complaint.accuser_account_id) {
      await createNotification({
        accountId: complaint.accuser_account_id,
        type: "complaint_accepted",
        titleEn: `Complaint #${complaintId} Accepted`,
        titleRo: `Reclamația #${complaintId} a fost Acceptată`,
        messageEn: `Your complaint #${complaintId} was accepted by ${session.username}. Verdict: ${finalVerdictText}`,
        messageRo: `Reclamația ta #${complaintId} a fost acceptată de ${session.username}. Verdict: ${finalVerdictText}`,
        linkUrl: `/support/complaints/${complaintId}`,
      });
    }

    if (complaint.accused_account_id) {
      await createNotification({
        accountId: complaint.accused_account_id,
        type: "complaint_accepted",
        titleEn: `Complaint #${complaintId} Accepted`,
        titleRo: `Reclamația #${complaintId} a fost acceptată`,
        messageEn: `A complaint against you was accepted by ${session.username}. ${queueSanction ? "A staff action is awaiting server confirmation." : ""}`,
        messageRo: `Reclamația împotriva ta a fost acceptată de ${session.username}. ${queueSanction ? "O acțiune administrativă așteaptă confirmarea serverului." : ""}`,
        linkUrl: `/support/complaints/${complaintId}`,
      });
    }

    return NextResponse.json({ success: true, status: "action_taken", verdict: finalVerdictText });
  }

  if (action === "dismiss") {
    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: "reason_required", message: "A reason is required to dismiss a complaint." }, { status: 400 });
    }

    await dbTransaction(async (conn) => {
      await conn.execute(
        `UPDATE panel_complaints 
         SET status = 'dismissed', verdict = ?, handled_by_account_id = ?, updated_at = NOW() 
         WHERE id = ?`,
        [reason, session.accountId, complaintId]
      );

      const decisionMsg = `[COMPLAINT DISMISSED]\nHandled by: ${session.username} [${staffBadge}]\nReason: ${reason}`;
      await conn.execute(
        `INSERT INTO panel_complaint_messages 
          (complaint_id, sender_account_id, sender_character_id, is_staff, role_badge, message)
         VALUES (?, ?, ?, 1, 'STAFF', ?)`,
        [complaintId, session.accountId, session.selectedCharacterId || null, decisionMsg]
      );
    });

    if (complaint.accuser_account_id) {
      await createNotification({
        accountId: complaint.accuser_account_id,
        type: "complaint_dismissed",
        titleEn: `Complaint #${complaintId} Dismissed`,
        titleRo: `Reclamația #${complaintId} a fost Respinsă`,
        messageEn: `Your complaint #${complaintId} was dismissed by ${session.username}. Reason: ${reason}`,
        messageRo: `Reclamația ta #${complaintId} a fost respinsă de ${session.username}. Motiv: ${reason}`,
        linkUrl: `/support/complaints/${complaintId}`,
      });
    }

    return NextResponse.json({ success: true, status: "dismissed", verdict: reason });
  }

  if (action === "close") {
    await dbExecute(
      `UPDATE panel_complaints SET status = 'dismissed', updated_at = NOW() WHERE id = ?`,
      [complaintId]
    );
    return NextResponse.json({ success: true, status: "dismissed" });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
