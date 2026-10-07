"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { useOnlinePlayers } from "@/hooks/useOnlinePlayers";

interface PlayersDirectoryTabsProps {
  activeTab: "all" | "online";
  locale: Locale;
  initialOnlineCount: number;
  initialOnlineFresh: boolean;
}

export function PlayersDirectoryTabs({
  activeTab,
  locale,
  initialOnlineCount,
  initialOnlineFresh,
}: PlayersDirectoryTabsProps) {
  const { data } = useOnlinePlayers(true);

  const onlineCount =
    data?.fresh === true ? data.playerCount : initialOnlineFresh ? initialOnlineCount : 0;

  const tabs = [
    { id: "all" as const, label: t(locale, "players.tab_all"), href: "/players?tab=all" },
    {
      id: "online" as const,
      label: t(locale, "players.tab_online", { count: onlineCount }),
      href: "/players?tab=online",
    },
  ];

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-white/[0.06] max-w-full pb-px -mx-1 px-1"
      data-scroll-x="local"
      aria-label={t(locale, "players.tabs_nav_aria")}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "shrink-0 whitespace-nowrap px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px",
              active
                ? "text-[#F2EFE8] border-[#D7B558]"
                : "text-[#8F8B83] border-transparent hover:text-[#B4AFA4]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
