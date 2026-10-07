"use client";

import Link from "next/link";
import { formatDate, t, type Locale } from "@/lib/i18n";
import type { PlayerManagementSanction } from "@/lib/player-management/types";

export function ModerationHistory({
  locale,
  username,
  sanctions,
  limit = 5,
  showFullLink = true,
}: {
  locale: Locale;
  username: string;
  sanctions: PlayerManagementSanction[];
  limit?: number;
  showFullLink?: boolean;
}) {
  const recent = sanctions.slice(0, limit);

  return (
    <div className="space-y-2 pt-3 border-t border-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8F8B83]">
          {t(locale, "playerManagement.recent_moderation")}
        </span>
        {showFullLink && sanctions.length > 0 && (
          <Link
            href={`/staff/players/${encodeURIComponent(username)}?tab=moderation`}
            className="text-[11px] font-semibold text-[#D7B558] hover:underline"
          >
            {t(locale, "playerManagement.view_full_history")}
          </Link>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="text-[11px] text-[#8F8B83]">{t(locale, "playerManagement.no_recent_sanctions")}</p>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((s) => (
            <li
              key={s.id}
              className="p-2 rounded-lg bg-[#131315] border border-white/[0.06] text-[11px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#D7B558]">{s.action.toUpperCase()}</span>
                <span className="text-[#8F8B83] font-mono shrink-0">{formatDate(s.created_at, locale)}</span>
              </div>
              <p className="text-[#F2EFE8] mt-0.5 line-clamp-2">{s.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
