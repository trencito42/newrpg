import { dbExecute, dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export type OrgType = "faction" | "clan";

export interface OrgProfile extends RowDataPacket {
  id: number;
  org_type: OrgType;
  org_id: string;
  cover_image: string | null;
  description_en: string | null;
  description_ro: string | null;
  rules_en: string | null;
  rules_ro: string | null;
  updated_by_account_id: number | null;
  created_at: string;
  updated_at: string;
}

const COVER_MAX_LEN = 512;

export function parseOrgType(value: string): OrgType | null {
  return value === "faction" || value === "clan" ? value : null;
}

export function normalizeCoverImageUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const url = String(raw).trim();
  if (!url) return null;
  if (url.length > COVER_MAX_LEN) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function getOrgProfile(orgType: OrgType, orgId: string): Promise<OrgProfile | null> {
  return dbQuerySingle<OrgProfile>(
    `SELECT id, org_type, org_id, cover_image, description_en, description_ro, rules_en, rules_ro,
            updated_by_account_id, created_at, updated_at
     FROM panel_org_profiles
     WHERE org_type = ? AND org_id = ? LIMIT 1`,
    [orgType, orgId]
  );
}

export async function upsertOrgProfile(
  orgType: OrgType,
  orgId: string,
  patch: {
    cover_image?: string | null;
    description_en?: string | null;
    description_ro?: string | null;
    rules_en?: string | null;
    rules_ro?: string | null;
  },
  updatedByAccountId: number
): Promise<void> {
  const existing = await getOrgProfile(orgType, orgId);
  if (!existing) {
    await dbExecute(
      `INSERT INTO panel_org_profiles
        (org_type, org_id, cover_image, description_en, description_ro, rules_en, rules_ro, updated_by_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgType,
        orgId,
        patch.cover_image ?? null,
        patch.description_en ?? null,
        patch.description_ro ?? null,
        patch.rules_en ?? null,
        patch.rules_ro ?? null,
        updatedByAccountId,
      ]
    );
    return;
  }

  const next = {
    cover_image: patch.cover_image !== undefined ? patch.cover_image : existing.cover_image,
    description_en: patch.description_en !== undefined ? patch.description_en : existing.description_en,
    description_ro: patch.description_ro !== undefined ? patch.description_ro : existing.description_ro,
    rules_en: patch.rules_en !== undefined ? patch.rules_en : existing.rules_en,
    rules_ro: patch.rules_ro !== undefined ? patch.rules_ro : existing.rules_ro,
  };

  await dbExecute(
    `UPDATE panel_org_profiles
     SET cover_image = ?, description_en = ?, description_ro = ?, rules_en = ?, rules_ro = ?, updated_by_account_id = ?
     WHERE org_type = ? AND org_id = ?`,
    [
      next.cover_image,
      next.description_en,
      next.description_ro,
      next.rules_en,
      next.rules_ro,
      updatedByAccountId,
      orgType,
      orgId,
    ]
  );
}
