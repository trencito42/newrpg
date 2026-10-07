import { dbExecute } from "@/lib/db";
import type { UserSession } from "@/lib/types";

export async function auditStaffChatLogAccess(
  session: UserSession,
  action: string,
  details: Record<string, unknown>
) {
  await dbExecute(
    `INSERT INTO panel_audit_log (actor_account_id, actor_character_id, action, target_entity, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      session.accountId,
      session.selectedCharacterId ?? null,
      action,
      "chat_logs",
      typeof details.logId === "number" ? details.logId : null,
      JSON.stringify(details),
    ]
  );
}
