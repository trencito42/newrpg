import type { ViewerSessionDTO } from "@/lib/types";
import { getFactionAccess } from "@/lib/faction-access";
import { dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { OrgType } from "@/lib/org-profile";

/** Same thresholds as public manage buttons / existing org APIs. */
export async function canManageOrganization(
  session: ViewerSessionDTO | null,
  orgType: OrgType,
  orgId: string
): Promise<boolean> {
  if (!session) return false;

  if (orgType === "faction") {
    if (session.adminLevel >= 3) return true;
    const access = await getFactionAccess(session.accountId, orgId);
    if (!access) return false;
    return Number(access.job_grade) >= 6 || Boolean(access.is_leader);
  }

  if (session.adminLevel >= 4) return true;
  const clanRow = await dbQuerySingle<RowDataPacket>(
    `SELECT cm.rank, c.owner_character_id, ch.id AS char_id
     FROM clan_members cm
     JOIN characters ch ON ch.id = cm.character_id
     JOIN players p ON p.id = ch.player_id
     JOIN clans c ON c.id = cm.clan_id
     WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
    [session.accountId, Number(orgId)]
  );
  if (!clanRow) return false;
  return Number(clanRow.rank) >= 6 || Number(clanRow.owner_character_id) === Number(clanRow.char_id);
}
