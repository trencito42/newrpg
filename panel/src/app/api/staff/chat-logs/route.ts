import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import {
  canViewChatLogs,
  canViewPrivateChatLogs,
  isPrivateChatChannel,
} from "@/lib/staff-chat-logs";
import { isAllowedChannelFilter, listChatLogs } from "@/lib/staff-chat-logs-query";
import { auditStaffChatLogAccess } from "@/lib/staff-chat-logs-audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !canViewChatLogs(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const page = Number(sp.get("page") || "1");
  const includePrivate = canViewPrivateChatLogs(session);
  const channel = sp.get("channel") || undefined;
  if (channel && !isAllowedChannelFilter(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  if (channel && isPrivateChatChannel(channel) && !includePrivate) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const filters = {
    page,
    characterId: sp.get("characterId") ? Number(sp.get("characterId")) : undefined,
    accountId: sp.get("accountId") ? Number(sp.get("accountId")) : undefined,
    text: sp.get("q") || sp.get("text") || undefined,
    channel,
    factionId: sp.get("factionId") || undefined,
    clanId: sp.get("clanId") ? Number(sp.get("clanId")) : undefined,
    targetCharacterId: sp.get("targetCharacterId")
      ? Number(sp.get("targetCharacterId"))
      : undefined,
    dateFrom: sp.get("from") || undefined,
    dateTo: sp.get("to") || undefined,
  };

  const result = await listChatLogs(filters, includePrivate);

  if (channel && isPrivateChatChannel(channel)) {
    await auditStaffChatLogAccess(session, "chat_logs.list_private", {
      permission: "admin.view_private_chat_logs",
      channel,
      page,
    });
  }

  return NextResponse.json({
    ...result,
    permissions: {
      "admin.view_chat_logs": true,
      "admin.view_private_chat_logs": includePrivate,
    },
  });
}
