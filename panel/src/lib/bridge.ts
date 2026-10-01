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
 * Retrieves the live server status via the internal FiveM bridge endpoint,
 * or gracefully falls back to database metrics with honest offline indicators.
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const bridgeUrl = process.env.FIVEM_BRIDGE_URL || "http://127.0.0.1:30121";
  const bridgeToken = process.env.FIVEM_BRIDGE_TOKEN;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s tight timeout

    const res = await fetch(`${bridgeUrl}/api/status`, {
      headers: {
        Authorization: `Bearer ${bridgeToken}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        playerCount: data.playerCount || 0,
        maxPlayers: data.maxPlayers || 64,
        serverName: data.serverName || process.env.NEXT_PUBLIC_SERVER_NAME || "Sunset RPG",
        uptimeSeconds: data.uptime || 0,
        version: data.version || "1.0.0",
      };
    }
  } catch {
    // FiveM bridge is offline or local port not running yet
  }

  // Fallback: server is not reachable via HTTP
  return {
    online: false,
    playerCount: 0,
    maxPlayers: 64,
    serverName: process.env.NEXT_PUBLIC_SERVER_NAME || "Sunset RPG",
    uptimeSeconds: 0,
    version: "1.0.0",
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
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM characters"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM vehicles"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM properties"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM clans"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM turfs WHERE owner_clan_id IS NOT NULL"),
    dbQuerySingle<CountRow>("SELECT COUNT(*) AS count FROM admin_sanctions"),
    dbQuerySingle<SumRow>("SELECT SUM(cash + bank) AS total FROM characters"),
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
