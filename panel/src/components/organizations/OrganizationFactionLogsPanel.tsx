"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ScrollText } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import {
  FACTION_LOG_PROFILE_PAGE_SIZE,
  type FactionLogCategory,
} from "@/lib/faction-logs";
import {
  FactionLogEventRow,
  labelForFactionLogEvent,
  type FactionLogListItem,
} from "@/components/organizations/FactionLogEventRow";

const CATEGORIES: FactionLogCategory[] = ["all", "members", "ranks", "warnings", "leadership", "applications"];

function pageRange(current: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const start = Math.max(1, Math.min(current - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function OrganizationFactionLogsPanel({
  locale,
  factionSlug,
  factionColor,
  targetCharacterId,
  compact,
  pageSize = compact ? FACTION_LOG_PROFILE_PAGE_SIZE : 25,
  fullHistoryHref,
}: {
  locale: Locale;
  factionSlug: string;
  factionColor: string;
  targetCharacterId?: number;
  compact?: boolean;
  pageSize?: number;
  fullHistoryHref?: string;
}) {
  const [category, setCategory] = useState<FactionLogCategory>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FactionLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const requestSeq = useRef(0);

  const limit = pageSize;

  const fetchLogs = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        category,
      });
      if (search.trim()) params.set("search", search.trim());
      if (targetCharacterId) params.set("targetCharacterId", String(targetCharacterId));
      const res = await fetch(`/api/organizations/faction/${encodeURIComponent(factionSlug)}/logs?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "fetch_failed");
      }
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      setItems(data.items || []);
      setTotal(Number(data.total) || 0);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
    } catch {
      if (seq !== requestSeq.current) return;
      setError(t(locale, "factionLogs.load_error"));
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [category, factionSlug, limit, locale, page, search, targetCharacterId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = total === 0 ? 0 : Math.min(page * limit, total);

  const pages = useMemo(() => pageRange(page, totalPages), [page, totalPages]);

  const historyLink =
    fullHistoryHref ?? (compact && targetCharacterId ? `/factions/${factionSlug}?tab=logs` : undefined);

  return (
    <div className={`space-y-3 ${compact ? "text-[11px]" : "text-xs"}`}>
      {!compact && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#F2EFE8]">{t(locale, "factionLogs.title")}</h2>
            <p className="text-[#8F8B83] mt-0.5 max-w-xl text-[11px]">{t(locale, "factionLogs.subtitle")}</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder={t(locale, "factionLogs.search_placeholder")}
            className="w-full sm:w-52 px-3 py-2 min-h-[40px] rounded-lg bg-[#101012] border border-white/[0.06] text-[#F2EFE8] placeholder:text-[#6B6760] text-xs"
            aria-label={t(locale, "factionLogs.search_placeholder")}
          />
        </div>
      )}

      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin -mx-1 px-1"
        role="tablist"
        aria-label={t(locale, "factionLogs.history_title")}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => {
              setPage(1);
              setCategory(cat);
            }}
            className={`shrink-0 px-2.5 py-1.5 min-h-[36px] rounded-md border text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/50 ${
              category === cat
                ? "border-white/20 bg-white/[0.08] text-[#F2EFE8]"
                : "border-white/[0.06] text-[#8F8B83] hover:text-[#F2EFE8]"
            }`}
          >
            {t(locale, `factionLogs.filter_${cat}`)}
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-[#0A0A0C] border border-white/[0.04] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[#8F8B83]" role="status">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: factionColor }} />
            <span>{t(locale, "factionLogs.loading")}</span>
          </div>
        ) : error ? (
          <div className="py-8 px-4 text-center space-y-3">
            <p className="text-rose-400 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => void fetchLogs()}
              className="px-3 py-2 min-h-[40px] rounded-lg bg-[#141417] text-[#F2EFE8] text-xs font-semibold hover:bg-[#1A1A1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/50"
            >
              {t(locale, "factionLogs.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <ScrollText className="w-7 h-7 mx-auto text-[#8F8B83] mb-2 opacity-60" aria-hidden />
            <p className="text-[#F2EFE8] font-medium text-sm">{t(locale, "factionLogs.empty_title")}</p>
            <p className="text-[#8F8B83] mt-1 text-[11px]">{t(locale, "factionLogs.empty_body")}</p>
          </div>
        ) : (
          <ul className="list-none m-0 p-0">
            {items.map((item) => (
              <FactionLogEventRow
                key={item.id}
                item={item}
                locale={locale}
                factionSlug={factionSlug}
                factionColor={factionColor}
                eventLabel={labelForFactionLogEvent(locale, item.eventType)}
                dense={compact}
              />
            ))}
          </ul>
        )}
      </div>

      {!loading && !error && total > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-[#8F8B83]">
          <p className="font-mono tabular-nums">
            {t(locale, "factionLogs.showing_range", {
              from: String(showingFrom),
              to: String(showingTo),
              total: String(total),
            })}
          </p>
          {totalPages > 1 ? (
            <nav className="flex flex-wrap items-center justify-end gap-1" aria-label={t(locale, "factionLogs.pagination")}>
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 min-h-[40px] min-w-[40px] rounded-md bg-[#101012] text-[#F2EFE8] disabled:opacity-40 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/50"
              >
                {t(locale, "factionLogs.prev_page")}
              </button>
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={loading}
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`min-h-[40px] min-w-[40px] px-2 rounded-md text-xs font-mono font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/50 ${
                    p === page
                      ? "bg-[#D7B558]/20 text-[#D7B558]"
                      : "bg-[#101012] text-[#8F8B83] hover:text-[#F2EFE8]"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 min-h-[40px] min-w-[40px] rounded-md bg-[#101012] text-[#F2EFE8] disabled:opacity-40 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/50"
              >
                {t(locale, "factionLogs.next_page")}
              </button>
            </nav>
          ) : null}
        </div>
      ) : null}

      {historyLink ? (
        <Link
          href={historyLink}
          className="inline-flex text-[11px] text-[#8F8B83] hover:text-[#D7B558] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/50 rounded"
        >
          {t(locale, "factionLogs.view_all")}
        </Link>
      ) : null}
    </div>
  );
}
