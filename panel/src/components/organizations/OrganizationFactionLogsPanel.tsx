"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUp, FileText, Loader2, ScrollText, Shield, Users } from "lucide-react";
import { t, formatDate, type Locale } from "@/lib/i18n";
import { factionLogCategoryForEvent, type FactionLogCategory, i18nKeyForFactionLogEvent } from "@/lib/faction-logs";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";

type LogItem = {
  id: number;
  eventType: string;
  actorCharacterId: number | null;
  targetCharacterId: number | null;
  actorUsername: string | null;
  targetUsername: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
};

const CATEGORIES: FactionLogCategory[] = ["all", "members", "ranks", "warnings", "leadership", "applications"];

function categoryIcon(category: Exclude<FactionLogCategory, "all">) {
  switch (category) {
    case "members":
      return Users;
    case "ranks":
      return ArrowUp;
    case "warnings":
      return AlertTriangle;
    case "leadership":
      return Shield;
    case "applications":
      return FileText;
    default:
      return ScrollText;
  }
}

function eventAccent(category: Exclude<FactionLogCategory, "all">): string {
  switch (category) {
    case "warnings":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "leadership":
      return "text-violet-400 bg-violet-500/10 border-violet-500/20";
    case "applications":
      return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    case "ranks":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    default:
      return "text-[#C4BFB6] bg-white/[0.04] border-white/[0.08]";
  }
}

export function OrganizationFactionLogsPanel({
  locale,
  factionSlug,
  factionColor,
  targetCharacterId,
  compact,
}: {
  locale: Locale;
  factionSlug: string;
  factionColor: string;
  targetCharacterId?: number;
  compact?: boolean;
}) {
  const [category, setCategory] = useState<FactionLogCategory>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LogItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
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
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setError(t(locale, "factionLogs.load_error"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, factionSlug, limit, locale, page, search, targetCharacterId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const eventLabel = useMemo(
    () => (eventType: string) => {
      const key = i18nKeyForFactionLogEvent(eventType);
      const label = t(locale, key);
      return label !== key ? label : eventType.replace(/_/g, " ");
    },
    [locale]
  );

  return (
    <div className={`space-y-4 ${compact ? "text-[11px]" : "text-xs"}`}>
      {!compact && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#F2EFE8]">{t(locale, "factionLogs.title")}</h2>
            <p className="text-[#8F8B83] mt-1 max-w-xl">{t(locale, "factionLogs.subtitle")}</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder={t(locale, "factionLogs.search_placeholder")}
            className="w-full sm:w-56 px-3 py-2.5 min-h-[44px] rounded-lg bg-[#101012] border border-white/[0.06] text-[#F2EFE8] placeholder:text-[#6B6760]"
          />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setPage(1);
              setCategory(cat);
            }}
            className={`shrink-0 px-3 py-2 min-h-[40px] rounded-lg border text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              category === cat
                ? "border-white/20 bg-white/[0.08] text-[#F2EFE8]"
                : "border-white/[0.06] text-[#8F8B83] hover:text-[#F2EFE8]"
            }`}
          >
            {t(locale, `factionLogs.filter_${cat}`)}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-[#0E0E10] border border-white/[0.04] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#8F8B83]">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: factionColor }} />
            <span>{t(locale, "factionLogs.loading")}</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-400">{error}</div>
        ) : items.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <ScrollText className="w-8 h-8 mx-auto text-[#8F8B83] mb-3 opacity-60" />
            <p className="text-[#F2EFE8] font-medium">{t(locale, "factionLogs.empty_title")}</p>
            <p className="text-[#8F8B83] mt-1">{t(locale, "factionLogs.empty_body")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {items.map((item) => {
              const cat = factionLogCategoryForEvent(item.eventType);
              const Icon = categoryIcon(cat);
              const accent = eventAccent(cat);
              return (
                <li key={item.id} className="p-3.5 sm:p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex gap-3">
                    <div
                      className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${accent}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-[#F2EFE8]">{eventLabel(item.eventType)}</span>
                        <span className="text-[10px] text-[#6B6760] font-mono">
                          {formatDate(item.createdAt, locale)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#B4AFA4]">
                        {item.actorUsername ? (
                          <PlayerIdentity username={item.actorUsername} factionId={factionSlug} size="sm" />
                        ) : (
                          <span className="italic text-[#8F8B83]">{t(locale, "factionLogs.system_actor")}</span>
                        )}
                        {(item.targetUsername || item.newValue || item.previousValue) && (
                          <>
                            <span className="text-[#6B6760]">→</span>
                            {item.targetUsername ? (
                              <PlayerIdentity username={item.targetUsername} factionId={factionSlug} size="sm" />
                            ) : null}
                            {item.previousValue && item.newValue ? (
                              <span className="font-mono text-[10px] text-[#8F8B83]">
                                {item.previousValue} → {item.newValue}
                              </span>
                            ) : item.newValue ? (
                              <span className="font-mono text-[10px]" style={{ color: factionColor }}>
                                {item.newValue}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                      {item.reason ? (
                        <p className="text-[#99958E] leading-relaxed break-words">{item.reason}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!loading && !error && totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-2 min-h-[44px] rounded-lg bg-[#101012] text-[#F2EFE8] disabled:opacity-40"
          >
            {t(locale, "factionLogs.prev_page")}
          </button>
          <span className="text-[#8F8B83] font-mono text-[11px]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-2 min-h-[44px] rounded-lg bg-[#101012] text-[#F2EFE8] disabled:opacity-40"
          >
            {t(locale, "factionLogs.next_page")}
          </button>
        </div>
      ) : null}

      {compact && targetCharacterId ? (
        <Link
          href={`/factions/${factionSlug}?tab=logs`}
          className="inline-flex text-[11px] text-[#8F8B83] hover:text-[#F2EFE8]"
        >
          {t(locale, "factionLogs.view_all")}
        </Link>
      ) : null}
    </div>
  );
}
