"use client";

import { type LucideIcon, AlertTriangle, ArrowUp, FileText, ScrollText, Shield, Users } from "lucide-react";
import { formatDate, type Locale, t } from "@/lib/i18n";
import {
  factionLogCategoryForEvent,
  type FactionLogCategory,
  i18nKeyForFactionLogEvent,
} from "@/lib/faction-logs";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";

export type FactionLogListItem = {
  id: number;
  eventType: string;
  actorUsername: string | null;
  targetUsername: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
};

function categoryIcon(category: Exclude<FactionLogCategory, "all">): LucideIcon {
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
      return "text-amber-400 bg-amber-500/10 border-amber-500/25";
    case "leadership":
      return "text-violet-400 bg-violet-500/10 border-violet-500/25";
    case "applications":
      return "text-sky-400 bg-sky-500/10 border-sky-500/25";
    case "ranks":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
    default:
      return "text-[#C4BFB6] bg-white/[0.04] border-white/[0.08]";
  }
}

export function FactionLogEventRow({
  item,
  locale,
  factionSlug,
  factionColor,
  eventLabel,
  dense,
}: {
  item: FactionLogListItem;
  locale: Locale;
  factionSlug: string;
  factionColor: string;
  eventLabel: string;
  dense?: boolean;
}) {
  const cat = factionLogCategoryForEvent(item.eventType);
  const Icon = categoryIcon(cat);
  const accent = eventAccent(cat);
  const rankChange =
    item.previousValue && item.newValue
      ? `${item.previousValue} → ${item.newValue}`
      : item.newValue
        ? item.newValue
        : null;

  return (
    <li
      className={`flex items-start gap-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors ${
        dense ? "py-2 px-3 min-h-[48px]" : "py-2.5 px-3.5 sm:px-4 min-h-[52px]"
      }`}
    >
      <div
        className={`shrink-0 rounded-md border flex items-center justify-center ${accent} ${
          dense ? "w-7 h-7" : "w-8 h-8"
        }`}
        aria-hidden
      >
        <Icon className={dense ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <span className={`font-semibold text-[#F2EFE8] ${dense ? "text-[11px]" : "text-xs"}`}>
            {eventLabel}
          </span>
          <time
            className="text-[10px] text-[#6B6760] font-mono tabular-nums shrink-0"
            dateTime={new Date(item.createdAt).toISOString()}
          >
            {formatDate(item.createdAt, locale, true)}
          </time>
        </div>
        <div
          className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[#B4AFA4] ${
            dense ? "text-[10px] mt-0.5" : "text-[11px] mt-1"
          }`}
        >
          {item.actorUsername ? (
            <PlayerIdentity username={item.actorUsername} factionId={factionSlug} size="sm" clickable={false} />
          ) : (
            <span className="italic text-[#8F8B83]">{t(locale, "factionLogs.system_actor")}</span>
          )}
          {(item.targetUsername || rankChange) && (
            <>
              <span className="text-[#5A5751]" aria-hidden>→</span>
              {item.targetUsername ? (
                <PlayerIdentity
                  username={item.targetUsername}
                  factionId={factionSlug}
                  size="sm"
                  clickable={false}
                />
              ) : null}
              {rankChange ? (
                <span className="font-mono text-[#8F8B83] whitespace-nowrap">{rankChange}</span>
              ) : null}
            </>
          )}
        </div>
        {item.reason ? (
          <p className={`text-[#8F8B83] leading-snug break-words ${dense ? "text-[10px] line-clamp-2 mt-0.5" : "text-[11px] line-clamp-3 mt-1"}`}>
            {item.reason}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function labelForFactionLogEvent(locale: Locale, eventType: string): string {
  const key = i18nKeyForFactionLogEvent(eventType);
  const label = t(locale, key);
  return label !== key ? label : eventType.replace(/_/g, " ");
}
