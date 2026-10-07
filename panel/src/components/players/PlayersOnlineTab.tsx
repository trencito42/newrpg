"use client";

import { useMemo } from "react";
import { useViewerLocale } from "@/components/LocaleProvider";
import { useOnlinePlayers } from "@/hooks/useOnlinePlayers";
import { t } from "@/lib/i18n";
import { OnlinePlayersList } from "@/components/players/OnlinePlayersList";

interface PlayersOnlineTabProps {
  query: string;
}

export function PlayersOnlineTab({ query }: PlayersOnlineTabProps) {
  const locale = useViewerLocale();
  const { data, loading } = useOnlinePlayers(true);

  const players = useMemo(() => {
    const roster = data?.fresh ? data.players : [];
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((p) => p.username.toLowerCase().includes(q));
  }, [data, query]);

  const totalOnline = data?.fresh ? data.playerCount : 0;
  const showingSearch = query.trim().length > 0;

  return (
    <div className="rounded-xl bg-surface-100 overflow-hidden">
      <div className="p-2.5 px-3 flex items-center justify-between text-xs text-[#99958E]">
        <span>
          {showingSearch
            ? t(locale, "players.online_search_count", { count: players.length, total: totalOnline })
            : t(locale, "players.online_count", { count: totalOnline })}
        </span>
        {data?.fresh === false && !loading ? (
          <span className="text-[10px] text-[#8F8B83]">{t(locale, "players.online_roster_stale")}</span>
        ) : null}
      </div>
      <OnlinePlayersList locale={locale} players={players} loading={loading && !data} />
    </div>
  );
}
