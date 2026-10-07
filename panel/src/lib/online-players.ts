import { dbQuery, dbQuerySingle } from "./db";
import { RowDataPacket } from "mysql2";

export const ONLINE_SNAPSHOT_STALE_SECONDS = 45;

export interface OnlinePlayerPublic {
  username: string;
  level: number;
  factionId: string | null;
  job: string;
  paydaysReceived: number;
  skin: string | null;
  clanTag: string | null;
  clanTagColor: string | null;
  clanTagStyle: string | null;
}

export interface OnlinePlayersPayload {
  fresh: boolean;
  playerCount: number;
  maxPlayers: number;
  players: OnlinePlayerPublic[];
}

interface SnapshotRow extends RowDataPacket {
  player_count: number;
  max_players: number;
  fresh: number;
}

interface RosterRow extends RowDataPacket {
  username: string;
  level: number;
  job: string;
  faction_id: string | null;
  paydays_received: number;
  skin: string | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
}

export async function fetchOnlinePlayersPayload(): Promise<OnlinePlayersPayload> {
  let snapshot: SnapshotRow | null = null;
  try {
    snapshot = await dbQuerySingle<SnapshotRow>(
      `SELECT player_count, max_players,
              (updated_at > NOW() - INTERVAL ${ONLINE_SNAPSHOT_STALE_SECONDS} SECOND) AS fresh
       FROM panel_runtime_snapshot WHERE id = 1`,
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw error;
  }

  const maxPlayers = snapshot?.max_players || 48;
  if (!snapshot?.fresh) {
    return { fresh: false, playerCount: 0, maxPlayers, players: [] };
  }

  let roster: RosterRow[] = [];
  try {
    roster = await dbQuery<RosterRow>(
      `SELECT r.username, r.level, r.job, r.faction_id, r.paydays_received, r.skin,
              cl.tag AS clan_tag, cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style
       FROM panel_online_roster r
       LEFT JOIN clan_members cm ON cm.character_id = r.character_id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       ORDER BY r.level DESC, r.username ASC`,
    );
  } catch (error) {
    if ((error as { code?: string }).code === "ER_NO_SUCH_TABLE") {
      return { fresh: false, playerCount: 0, maxPlayers, players: [] };
    }
    throw error;
  }

  const players: OnlinePlayerPublic[] = roster.map((row) => ({
    username: row.username,
    level: row.level,
    factionId: row.faction_id,
    job: row.job,
    paydaysReceived: row.paydays_received,
    skin: row.skin,
    clanTag: row.clan_tag,
    clanTagColor: row.clan_tag_color,
    clanTagStyle: row.clan_tag_style,
  }));

  const playerCount = players.length;
  if (playerCount !== snapshot.player_count) {
    console.warn(
      `[online-players] roster count (${playerCount}) != snapshot player_count (${snapshot.player_count}); using roster length`,
    );
  }

  return {
    fresh: true,
    playerCount,
    maxPlayers,
    players,
  };
}
