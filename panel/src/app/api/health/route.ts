import { NextResponse } from "next/server";
import { dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "disconnected";

  try {
    interface PingRow extends RowDataPacket {
      pong: number;
    }
    const res = await dbQuerySingle<PingRow>("SELECT 1 AS pong");
    if (res?.pong === 1) {
      dbStatus = "connected";
    }
  } catch (err: any) {
    dbStatus = "error";
  }

  const isHealthy = dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      database: dbStatus,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
    { status: isHealthy ? 200 : 503 }
  );
}
