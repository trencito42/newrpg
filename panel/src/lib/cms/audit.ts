import { dbExecute } from "@/lib/db";
import type { CmsAdminSession } from "./auth";

export async function writeCmsAudit(
  session: CmsAdminSession,
  action: string,
  targetEntity: string,
  targetId: number | null,
  details?: Record<string, unknown>
) {
  await dbExecute(
    `INSERT INTO panel_audit_log (actor_account_id, actor_character_id, action, target_entity, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      session.accountId,
      session.selectedCharacterId ?? null,
      action,
      targetEntity,
      targetId,
      details ? JSON.stringify(details) : null,
    ]
  );
}
