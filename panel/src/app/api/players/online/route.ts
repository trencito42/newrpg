import { NextResponse } from "next/server";
import { fetchOnlinePlayersPayload } from "@/lib/online-players";

export async function GET() {
  try {
    const payload = await fetchOnlinePlayersPayload();
    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("[api/players/online]", err);
    return NextResponse.json(
      { fresh: false, playerCount: 0, maxPlayers: 48, players: [] },
      { status: 500 },
    );
  }
}
