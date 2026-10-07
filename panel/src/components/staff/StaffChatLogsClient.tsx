"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { t, type Locale, formatDate } from "@/lib/i18n";
import { CHAT_LOG_CHANNEL_TYPES } from "@/lib/staff-chat-logs";
import type { ChatLogRow } from "@/lib/staff-chat-logs-query";
import { MessageSquare, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Props = {
  locale: Locale;
  /** Pre-filter by player (staff profile tab). */
  playerUsername?: string;
  characterId?: number;
  /** Hide page title when embedded in player profile. */
  embedded?: boolean;
};

export function StaffChatLogsClient({
  locale,
  playerUsername,
  characterId,
  embedded = false,
}: Props) {
  const [items, setItems] = useState<ChatLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("");
  const [contextId, setContextId] = useState<number | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextData, setContextData] = useState<{
    selected: ChatLogRow;
    before: ChatLogRow[];
    after: ChatLogRow[];
  } | null>(null);
  const [canViewPrivate, setCanViewPrivate] = useState(false);

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (q.trim()) params.set("q", q.trim());
    if (channel) params.set("channel", channel);
    if (playerUsername) {
      const slug = encodeURIComponent(playerUsername.replace(/ /g, "_"));
      return `/api/staff/players/${slug}/chat-logs?${params.toString()}${
        characterId ? `&characterId=${characterId}` : ""
      }`;
    }
    if (characterId) params.set("characterId", String(characterId));
    return `/api/staff/chat-logs?${params.toString()}`;
  }, [page, q, channel, playerUsername, characterId]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(listUrl, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setCanViewPrivate(Boolean(data.permissions?.["admin.view_private_chat_logs"]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openContext = async (id: number) => {
    setContextId(id);
    setContextLoading(true);
    setContextData(null);
    try {
      const res = await fetch(`/api/staff/chat-logs/${id}/context`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      setContextData(await res.json());
    } catch {
      setContextData(null);
    } finally {
      setContextLoading(false);
    }
  };

  const channelLabel = (ch: string) =>
    t(locale, `staffChatLogs.channel.${ch}` as "staffChatLogs.title") || ch;

  const renderRow = (row: ChatLogRow, highlight?: boolean) => (
    <div
      key={row.id}
      className={`p-2.5 rounded border text-xs space-y-1 ${
        highlight
          ? "bg-amber-950/30 border-amber-500/40"
          : "bg-[#131315] border-surface-border"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-[#8F8B83]">#{row.id}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1A1A1D] border border-surface-border text-[#D7B558]">
            {channelLabel(row.channel_type)}
          </span>
          {row.status === "blocked" && (
            <span className="text-[10px] text-red-400 font-bold">
              {t(locale, "staffChatLogs.status_blocked")}
            </span>
          )}
          {row.pm_direction && (
            <span className="text-[10px] text-sky-400">
              {row.pm_direction === "sent"
                ? t(locale, "staffChatLogs.pm_sent")
                : t(locale, "staffChatLogs.pm_received")}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-[#8F8B83] shrink-0">
          {formatDate(row.created_at, locale)}
        </span>
      </div>
      <div className="text-[#F2EFE8]">
        <span className="font-semibold">{escapeHtml(row.player_name_snapshot)}</span>
        {row.target_name_snapshot && (
          <span className="text-[#8F8B83]">
            {" → "}
            {escapeHtml(row.target_name_snapshot)}
          </span>
        )}
      </div>
      <p className="text-[#C8C4BC] break-words whitespace-pre-wrap">{escapeHtml(row.message)}</p>
      {!highlight && (
        <button
          type="button"
          onClick={() => openContext(row.id)}
          className="text-[10px] text-[#D7B558] hover:underline"
        >
          {t(locale, "staffChatLogs.view_context")}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center gap-2 pb-2 border-b border-surface-border">
          <MessageSquare className="w-5 h-5 text-[#D7B558]" />
          <div>
            <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "staffChatLogs.title")}</h1>
            <p className="text-[11px] text-[#8F8B83]">{t(locale, "staffChatLogs.subtitle")}</p>
          </div>
        </div>
      )}

      {!canViewPrivate && (
        <p className="text-[11px] text-amber-400/90 border border-amber-500/30 rounded p-2 bg-amber-950/20">
          {t(locale, "staffChatLogs.private_hidden")}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder={t(locale, "staffChatLogs.search_message")}
          className="flex-1 px-3 py-2 text-xs bg-[#0E0E10] border border-surface-border rounded text-[#F2EFE8]"
        />
        <button
          type="button"
          onClick={() => fetchList()}
          className="px-3 py-2 text-xs font-bold rounded bg-[#D7B558] text-black"
        >
          {t(locale, "staffChatLogs.search")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            setChannel("");
            setPage(1);
          }}
          className={`px-2 py-1 text-[10px] rounded border ${
            !channel
              ? "border-[#D7B558] text-[#D7B558]"
              : "border-surface-border text-[#8F8B83]"
          }`}
        >
          {t(locale, "staffChatLogs.all_channels")}
        </button>
        {CHAT_LOG_CHANNEL_TYPES.map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => {
              setChannel(ch);
              setPage(1);
            }}
            className={`px-2 py-1 text-[10px] rounded border ${
              channel === ch
                ? "border-[#D7B558] text-[#D7B558]"
                : "border-surface-border text-[#8F8B83]"
            }`}
          >
            {channelLabel(ch)}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-8 text-[#8F8B83]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-xs text-[#8F8B83] py-6">{t(locale, "staffChatLogs.empty")}</p>
      ) : (
        <div className="space-y-2">{items.map((row) => renderRow(row))}</div>
      )}

      <div className="flex items-center justify-between text-xs text-[#8F8B83]">
        <span>
          {t(locale, "staffChatLogs.page_info", {
            page: String(page),
            totalPages: String(totalPages),
            total: String(total),
          })}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded border border-surface-border disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded border border-surface-border disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {contextId != null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0E0E10] border border-surface-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#F2EFE8]">
                {t(locale, "staffChatLogs.context_title")}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setContextId(null);
                  setContextData(null);
                }}
                className="text-xs text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                {t(locale, "staffChatLogs.close")}
              </button>
            </div>
            {contextLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#8F8B83]" />
              </div>
            )}
            {!contextLoading && contextData && (
              <div className="space-y-2">
                {contextData.before.map((row) => renderRow(row))}
                {renderRow(contextData.selected, true)}
                {contextData.after.map((row) => renderRow(row))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
