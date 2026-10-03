"use client";

import { useState } from "react";
import Link from "next/link";
import { type Locale, t, formatCurrency, formatNumber } from "@/lib/i18n";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { Coins, Trophy, Zap, ChevronRight, User } from "lucide-react";

export interface RichestPlayerItem {
  id: number;
  characterName: string;
  skin: string;
  cash: number;
  bank: number;
  netWorth: number;
  level: number;
}

export interface LeveledPlayerItem {
  id: number;
  characterName: string;
  skin: string;
  level: number;
  xp: number;
  netWorth: number;
}

interface HomeLeaderboardTabsProps {
  richest: RichestPlayerItem[];
  leveled: LeveledPlayerItem[];
  locale: Locale;
}

export function HomeLeaderboardTabs({ richest, leveled, locale }: HomeLeaderboardTabsProps) {
  const [tab, setTab] = useState<"wealth" | "level">("wealth");

  return (
    <div className="rounded-xl bg-[#0E0E10] p-4 space-y-4">
      {/* Header & Tab Selector */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#D7B558]/10 flex items-center justify-center text-[#D7B558]">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "copy.components_home_homeleaderboardtabs.top_server_players")}
            </h2>
            <span className="text-[10px] text-[#8F8B83] block">
              {t(locale, "copy.components_home_homeleaderboardtabs.most_wealthy_experienced_citizens")}
            </span>
          </div>
        </div>

        <div className="flex items-center bg-[#141417] p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setTab("wealth")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              tab === "wealth" ? "bg-[#202026] text-[#F2EFE8]" : "text-[#8F8B83] hover:text-[#F2EFE8]"
            }`}
          >
            <Coins className="w-3 h-3 text-[#D7B558]" />
            <span className="hidden sm:inline">{t(locale, "copy.components_home_homeleaderboardtabs.wealth")}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("level")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              tab === "level" ? "bg-[#202026] text-[#F2EFE8]" : "text-[#8F8B83] hover:text-[#F2EFE8]"
            }`}
          >
            <Zap className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">{t(locale, "common.level")}</span>
          </button>
        </div>
      </div>

      {/* Players List */}
      <div className="space-y-2">
        {tab === "wealth" ? (
          richest.map((player, idx) => {
            const avatarUrl = getPedAvatarUrl(player.skin);
            const rankBadge =
              idx === 0
                ? "bg-amber-500/20 text-amber-300"
                : idx === 1
                ? "bg-slate-400/20 text-slate-200"
                : idx === 2
                ? "bg-amber-700/20 text-amber-400"
                : "bg-[#18181D] text-[#8F8B83]";

            return (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#121214] hover:bg-[#18181C] transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[11px] font-bold shrink-0 ${rankBadge}`}>
                    {idx + 1}
                  </span>

                  <div className="w-8 h-8 rounded-full bg-[#1A1A1E] overflow-hidden shrink-0 flex items-center justify-center">
                    {avatarUrl ? (
                      <GTAImage
                        src={avatarUrl}
                        alt={player.characterName}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <User className="w-4 h-4 text-[#8F8B83]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-[#F2EFE8] group-hover:text-[#D7B558] transition-colors truncate block">
                      {player.characterName}
                    </span>
                    <span className="text-[10px] text-[#8F8B83] font-mono">
                      {t(locale, "common.level")} {player.level}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-xs text-emerald-400 block">
                    {formatCurrency(player.netWorth)}
                  </span>
                  <span className="text-[10px] text-[#8F8B83] font-mono">
                    {t(locale, "interface.cash_bank")}
                  </span>
                </div>
              </Link>
            );
          })
        ) : (
          leveled.map((player, idx) => {
            const avatarUrl = getPedAvatarUrl(player.skin);
            const rankBadge =
              idx === 0
                ? "bg-sky-500/20 text-sky-300"
                : idx === 1
                ? "bg-slate-400/20 text-slate-200"
                : idx === 2
                ? "bg-amber-700/20 text-amber-400"
                : "bg-[#18181D] text-[#8F8B83]";

            return (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#121214] hover:bg-[#18181C] transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[11px] font-bold shrink-0 ${rankBadge}`}>
                    {idx + 1}
                  </span>

                  <div className="w-8 h-8 rounded-full bg-[#1A1A1E] overflow-hidden shrink-0 flex items-center justify-center">
                    {avatarUrl ? (
                      <GTAImage
                        src={avatarUrl}
                        alt={player.characterName}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <User className="w-4 h-4 text-[#8F8B83]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-[#F2EFE8] group-hover:text-sky-300 transition-colors truncate block">
                      {player.characterName}
                    </span>
                    <span className="text-[10px] text-[#8F8B83] font-mono">
                      {formatNumber(player.xp, locale as "en" | "ro")} XP
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-xs text-sky-400 px-2 py-0.5 rounded bg-sky-500/10">
                    LVL {player.level}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Footer Link */}
      <div className="pt-2 border-t border-surface-border text-center">
        <Link
          href="/stats"
          className="inline-flex items-center gap-1 text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors"
        >
          <span>{t(locale, "copy.components_home_homeleaderboardtabs.view_full_rankings_statistics")}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
