import { dbExecute } from "@/lib/db";

export async function writeOrgProfileAudit(
  actorAccountId: number,
  actorCharacterId: number | null,
  action: string,
  orgType: string,
  orgId: string,
  fields: string[]
) {
  await dbExecute(
    `INSERT INTO panel_audit_log (actor_account_id, actor_character_id, action, target_entity, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      actorAccountId,
      actorCharacterId,
      action,
      "organization_profile",
      null,
      JSON.stringify({ org_type: orgType, org_id: orgId, fields }),
    ]
  );
}
