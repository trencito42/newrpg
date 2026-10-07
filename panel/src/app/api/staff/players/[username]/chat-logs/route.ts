import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import {
  canViewChatLogs,
  canViewPrivateChatLogs,
  isPrivateChatChannel,
} from "@/lib/staff-chat-logs";
import { isAllowedChannelFilter, listChatLogs } from "@/lib/staff-chat-logs-query";
import { auditStaffChatLogAccess } from "@/lib/staff-chat-logs-audit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session || !canViewChatLogs(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { username: rawUsername } = await context.params;
  const username = decodeURIComponent(rawUsername).replace(/_/g, " ");

  const account = await dbQuerySingle<RowDataPacket>(
    `SELECT id AS account_id FROM accounts WHERE LOWER(username) = LOWER(?) LIMIT 1`,
    [username]
  );
  if (!account?.account_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const accountId = Number(account.account_id);

  const sp = req.nextUrl.searchParams;
  const characterIdParam = sp.get("characterId");
  let characterId = characterIdParam ? Number(characterIdParam) : undefined;

  if (!characterId) {
    const row = await dbQuerySingle<RowDataPacket>(
      `SELECT c.id AS character_id FROM accounts a
       LEFT JOIN players p ON p.account_id = a.id
       LEFT JOIN characters c ON c.player_id = p.id
       WHERE a.id = ?
       ORDER BY c.last_played DESC
       LIMIT 1`,
      [accountId]
    );
    characterId = row?.character_id ? Number(row.character_id) : undefined;
  }

  if (!characterId) {
    return NextResponse.json({ items: [], page: 1, pageSize: 50, total: 0 });
  }

  const includePrivate = canViewPrivateChatLogs(session);
  const channel = sp.get("channel") || undefined;
  if (channel && !isAllowedChannelFilter(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  if (channel && isPrivateChatChannel(channel) && !includePrivate) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const page = Number(sp.get("page") || "1");
  const result = await listChatLogs(
    {
      page,
      playerScopeCharacterId: characterId,
      text: sp.get("q") || undefined,
      channel,
      factionId: sp.get("factionId") || undefined,
      clanId: sp.get("clanId") ? Number(sp.get("clanId")) : undefined,
      targetCharacterId: sp.get("targetCharacterId")
        ? Number(sp.get("targetCharacterId"))
        : undefined,
      dateFrom: sp.get("from") || undefined,
      dateTo: sp.get("to") || undefined,
    },
    includePrivate
  );

  await auditStaffChatLogAccess(session, "chat_logs.player_scope", {
    permission: includePrivate ? "admin.view_private_chat_logs" : "admin.view_chat_logs",
    targetAccountId: accountId,
    characterId,
    page,
  });

  return NextResponse.json({
    ...result,
    characterId,
    accountId,
  });
}
