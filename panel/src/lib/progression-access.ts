import { RowDataPacket } from "mysql2";
import { dbQuerySingle } from "@/lib/db";

export interface ProgressionAccessResult {
  allowed: boolean;
  error?: "character_not_found" | "level_too_low" | "quest_required";
  minLevel?: number;
  questKey?: string;
}

const FACTION_APPLICATION_LEVEL = 10;
const FACTION_APPLICATION_QUEST = "life_reach_level10";

export async function getFactionApplicationAccess(characterId: number): Promise<ProgressionAccessResult> {
  const row = await dbQuerySingle<RowDataPacket>(
    `SELECT c.level, cq.status AS quest_status
     FROM characters c
     LEFT JOIN character_quests cq
       ON cq.character_id = c.id AND cq.quest_key = ?
     WHERE c.id = ? LIMIT 1`,
    [FACTION_APPLICATION_QUEST, characterId]
  );

  if (!row) return { allowed: false, error: "character_not_found" };
  if (Number(row.level) < FACTION_APPLICATION_LEVEL) {
    return { allowed: false, error: "level_too_low", minLevel: FACTION_APPLICATION_LEVEL };
  }
  if (row.quest_status !== "complete" && row.quest_status !== "claimed") {
    return { allowed: false, error: "quest_required", questKey: FACTION_APPLICATION_QUEST };
  }
  return { allowed: true };
}
