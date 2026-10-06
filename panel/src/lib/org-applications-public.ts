import { dbQuery, dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { OrgType } from "@/lib/org-profile";

export const FACTION_GLOBAL_MIN_LEVEL = 10;

export interface OrgApplicationSettingsPublic {
  applications_open: boolean;
  min_level: number;
  min_hours: number;
  max_warnings: number;
  cooldown_hours: number;
  effective_min_level: number;
}

export async function getOrgApplicationSettings(
  orgType: OrgType,
  orgId: string
): Promise<OrgApplicationSettingsPublic> {
  const row = await dbQuerySingle<RowDataPacket>(
    `SELECT applications_open, min_level, min_hours, max_warnings, cooldown_hours
     FROM panel_org_application_settings
     WHERE org_type = ? AND org_id = ? LIMIT 1`,
    [orgType, orgId]
  );

  const minLevel = Number(row?.min_level ?? 0);
  const globalMin = orgType === "faction" ? FACTION_GLOBAL_MIN_LEVEL : 10;

  return {
    applications_open: Boolean(row?.applications_open),
    min_level: minLevel,
    min_hours: Number(row?.min_hours ?? 0),
    max_warnings: Number(row?.max_warnings ?? 0),
    cooldown_hours: Number(row?.cooldown_hours ?? 24),
    effective_min_level: Math.max(globalMin, minLevel),
  };
}

export async function getViewerOrgApplication(
  orgType: OrgType,
  orgId: string,
  accountId: number | null
) {
  if (!accountId) return null;
  return dbQuerySingle<RowDataPacket>(
    `SELECT id, status, created_at, updated_at
     FROM panel_org_applications
     WHERE org_type = ? AND org_id = ? AND account_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [orgType, orgId, accountId]
  );
}

export async function getActiveApplicationQuestions(orgType: OrgType, orgId: string) {
  return dbQuery<RowDataPacket>(
    `SELECT id, label_en, label_ro, question_type, required, sort_order
     FROM panel_org_application_questions
     WHERE org_type = ? AND org_id = ? AND active = 1
     ORDER BY sort_order ASC, id ASC`,
    [orgType, orgId]
  );
}
