"use client";

import { useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { horizontalCardSlideClass } from "@/components/ui/HorizontalCardScroller";
import { useViewerLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { useOnlinePlayers } from "@/hooks/useOnlinePlayers";
import { OnlinePlayersModal } from "./OnlinePlayersModal";

interface HomePlayersOnlineCardProps {
  initialCount: number;
  initialMax: number;
  initialFresh: boolean;
}

export function HomePlayersOnlineCard({
  initialCount,
  initialMax,
  initialFresh,
}: HomePlayersOnlineCardProps) {
  const locale = useViewerLocale();
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading } = useOnlinePlayers(true);

  const maxPlayers = data?.maxPlayers ?? initialMax;
  const playerCount = data?.fresh ? data.playerCount : initialFresh ? initialCount : 0;
  const pct = Math.min(100, Math.round((playerCount / (maxPlayers || 64)) * 100));

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`${horizontalCardSlideClass} max-sm:w-[min(240px,calc(100vw-2*var(--panel-gutter)-var(--racket-hscroll-peek)))] sm:w-auto p-4 rounded-xl bg-[#0E0E10] text-left w-full cursor-pointer border border-transparent hover:border-emerald-500/25 hover:bg-[#121214] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0C] transition-colors group`}
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider group-hover:text-[#A8A49C] transition-colors">
            {t(locale, "home.players_online")}
          </span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Users className="w-3.5 h-3.5" aria-hidden />
          </div>
        </div>
        <div className="mt-2 text-xl font-bold font-mono text-[#F2EFE8]">
          {playerCount}{" "}
          <span className="text-xs text-[#8F8B83] font-normal">/ {maxPlayers}</span>
        </div>
        <div className="mt-2 w-full bg-[#1A1A1E] rounded-full h-1 overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 flex items-center justify-between text-[11px] text-[#8F8B83] group-hover:text-emerald-400/90 transition-colors">
          <span>{t(locale, "home.view_online_players")}</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" aria-hidden />
        </p>
      </button>

      <OnlinePlayersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        loading={loading}
      />
    </>
  );
}
