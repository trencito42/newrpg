import { dbQuerySingle } from "./db";
import { factionGradeSql, factionIdSql } from "./faction-sql";
import type { RowDataPacket } from "mysql2";

export interface FactionAccess extends RowDataPacket {
  id: number;
  job: string;
  job_grade: number;
  is_leader: number | null;
}

/** Same membership source as the game; a civilian job is not a faction. */
export async function getFactionAccess(accountId: number, factionId: string): Promise<FactionAccess | null> {
  return dbQuerySingle<FactionAccess>(
    `SELECT c.id, fm.faction_id AS job, ${factionGradeSql()} AS job_grade, fl.id AS is_leader
     FROM faction_membership fm
     JOIN characters c ON c.id = fm.character_id
     JOIN players p ON p.id = c.player_id
     LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id COLLATE utf8mb4_unicode_ci = fm.faction_id COLLATE utf8mb4_unicode_ci
     WHERE p.account_id = ? AND fm.faction_id = ? AND ${factionIdSql()} = fm.faction_id
     LIMIT 1`,
    [accountId, factionId]
  );
}
