import { dbExecute } from "./db";

export async function writeFactionLogFromPanel(input: {
  factionId: string;
  eventType: string;
  actorCharacterId: number | null;
  targetCharacterId: number | null;
  actorUsername?: string | null;
  targetUsername?: string | null;
  reason?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await dbExecute(
    `INSERT INTO faction_logs (
      faction_id, event_type, actor_character_id, target_character_id,
      actor_name_snapshot, target_name_snapshot,
      previous_value, new_value, reason, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.factionId,
      input.eventType,
      input.actorCharacterId,
      input.targetCharacterId,
      input.actorUsername ?? null,
      input.targetUsername ?? null,
      input.previousValue ?? null,
      input.newValue ?? null,
      input.reason?.slice(0, 512) ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
}
