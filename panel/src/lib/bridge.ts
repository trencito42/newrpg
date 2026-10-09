import { dbQuery, dbQuerySingle } from "./db";
import { RowDataPacket } from "mysql2";

export interface ServerStatus {
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  serverName: string;
  uptimeSeconds: number;
  version: string;
}

export interface AggregatedStats {
  totalAccounts: number;
  totalCharacters: number;
  totalVehicles: number;
  totalProperties: number;
  totalClans: number;
  totalSanctions: number;
  controlledTurfs: number;
  totalEconomyMoney: number;
}

/**
 * Reads the last authoritative FiveM heartbeat. A stale heartbeat is offline.
 */
export async function getServerStatus(): Promise<ServerStatus> {
  interface SnapshotRow extends RowDataPacket {
    player_count: number;
    max_players: number;
    resource_version: string;
    fresh: number;
  }
  const name = process.env.NEXT_PUBLIC_SERVER_NAME || "Racket RPG";
  let snapshot: SnapshotRow | null = null;
  try {
    snapshot = await dbQuerySingle<SnapshotRow>(
      "SELECT player_count, max_players, resource_version, (updated_at > NOW() - INTERVAL 45 SECOND) AS fresh FROM panel_runtime_snapshot WHERE id = 1"
    );
  } catch (error) {
    // During the migration window, show offline; do not invent a player count.
    if ((error as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw error;
  }
  if (snapshot?.fresh) return {
    online: true,
    playerCount: snapshot.player_count,
    maxPlayers: snapshot.max_players,
    serverName: name,
    uptimeSeconds: 0,
    version: snapshot.resource_version,
  };
  return {
    online: false,
    playerCount: 0,
    maxPlayers: snapshot?.max_players || 0,
    serverName: name,
    uptimeSeconds: 0,
    version: snapshot?.resource_version || "unknown",
  };
}

/**
 * Retrieves server-wide aggregated statistics directly from MariaDB.
 * Uses index-backed COUNT queries to protect database performance.
 */
export async function getAggregatedServerStats(): Promise<AggregatedStats> {
  interface CountRow extends RowDataPacket {
    count: number;
  }
  interface SumRow extends RowDataPacket {
    total: number | null;
  }

  const [
    accountsRow,
    charactersRow,
    vehiclesRow,
    propertiesRow,
    clansRow,
    turfsRow,
    sanctionsRow,
    moneyRow,
  ] = await Promise.all([
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM accounts"),
    dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS count FROM characters c
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       WHERE a.username NOT IN ('anticheat')`
    ),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM vehicles"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM properties"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM clans"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM turfs WHERE owner_clan_id IS NOT NULL"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM admin_sanctions"),
    dbQuerySingle<SumRow>(
      `SELECT COALESCE(SUM(c.cash + c.bank), 0) AS total
       FROM characters c
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       WHERE a.username NOT IN ('anticheat')`
    ),
  ]);

  return {
    totalAccounts: accountsRow?.count || 0,
    totalCharacters: charactersRow?.count || 0,
    totalVehicles: vehiclesRow?.count || 0,
    totalProperties: propertiesRow?.count || 0,
    totalClans: clansRow?.count || 0,
    controlledTurfs: turfsRow?.count || 0,
    totalSanctions: sanctionsRow?.count || 0,
    totalEconomyMoney: Number(moneyRow?.total) || 0,
  };
}
