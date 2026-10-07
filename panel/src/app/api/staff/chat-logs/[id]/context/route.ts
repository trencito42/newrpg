import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { canViewChatLogs, canViewPrivateChatLogs } from "@/lib/staff-chat-logs";
import { getChatLogContext } from "@/lib/staff-chat-logs-query";
import { auditStaffChatLogAccess } from "@/lib/staff-chat-logs-audit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session || !canViewChatLogs(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: rawId } = await context.params;
  const logId = Number(rawId);
  if (!logId || logId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const includePrivate = canViewPrivateChatLogs(session);
  const ctx = await getChatLogContext(logId, includePrivate);
  if (!ctx) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if ("forbidden" in ctx && ctx.forbidden) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await auditStaffChatLogAccess(session, "chat_logs.view_context", {
    permission: includePrivate ? "admin.view_private_chat_logs" : "admin.view_chat_logs",
    logId,
    channel: ctx.selected.channel_type,
  });

  return NextResponse.json(ctx);
}
