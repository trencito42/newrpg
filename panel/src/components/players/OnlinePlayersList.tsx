"use client";

import Link from "next/link";
import { getFactionLabel, isFaction } from "@/lib/factions";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { t, type Locale } from "@/lib/i18n";
import { GTAImage } from "@/components/ui/GTAImage";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import type { OnlinePlayerPublic } from "@/lib/online-players";

function profileHref(username: string) {
  return `/players/${encodeURIComponent(username.trim().replace(/\s+/g, "_"))}`;
}

function formatJob(job: string) {
  if (!job || job === "unemployed") return "—";
  return job.replace(/_/g, " ");
}

interface OnlinePlayersListProps {
  locale: Locale;
  players: OnlinePlayerPublic[];
  loading?: boolean;
}

export function OnlinePlayersList({ locale, players, loading }: OnlinePlayersListProps) {
  if (loading && players.length === 0) {
    return (
      <div className="space-y-2 p-3" aria-busy="true" aria-label={t(locale, "players.tab_online_label")}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-200/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!loading && players.length === 0) {
    return (
      <div className="py-12 px-6 text-center">
        <p className="text-sm font-semibold text-[#F2EFE8]">{t(locale, "home.online_empty_title")}</p>
        <p className="mt-2 text-xs text-[#8F8B83] max-w-sm mx-auto">{t(locale, "home.online_empty_body")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block responsive-table-wrapper">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] font-semibold text-[#8F8B83] bg-surface-200/50 sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</th>
              <th className="py-2.5 px-3">{t(locale, "common.level")}</th>
              <th className="py-2.5 px-3">{t(locale, "players.faction")}</th>
              <th className="py-2.5 px-3">{t(locale, "interface.job")}</th>
              <th className="py-2.5 px-3">{t(locale, "players.hours_played")}</th>
            </tr>
          </thead>
          <tbody className="text-[#B4AFA4]">
            {players.map((p) => {
              const hasFaction = isFaction(p.factionId);
              const factionLabel = hasFaction ? getFactionLabel(p.factionId) : "—";
              return (
                <tr key={p.username} className="hover:bg-surface-200/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <Link href={profileHref(p.username)} className="flex items-center gap-2.5 group">
                      <div className="relative w-7 h-7 rounded-lg bg-surface-200 border border-surface-border overflow-hidden shrink-0">
                        <GTAImage
                          src={getPedAvatarUrl(p.skin)}
                          alt=""
                          fallbackText={p.username.charAt(0).toUpperCase()}
                          className="w-full h-full object-cover object-top"
                        />
                        <span
                          className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0E0E10]"
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0">
                        <PlayerIdentity
                          username={p.username}
                          factionId={p.factionId}
                          clanTag={p.clanTag}
                          clanColor={p.clanTagColor}
                          clanTagStyle={p.clanTagStyle}
                          href={profileHref(p.username)}
                          size="sm"
                          clickable={false}
                        />
                        <span className="inline-flex mt-0.5 items-center gap-1 text-[10px] font-medium text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                          {t(locale, "home.online_status_now")}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-medium text-[#F2EFE8]">{p.level}</td>
                  <td className="py-2.5 px-3">{hasFaction ? <span className="text-[#F2EFE8]">{factionLabel}</span> : "—"}</td>
                  <td className="py-2.5 px-3 capitalize">{formatJob(p.job)}</td>
                  <td className="py-2.5 px-3 font-mono">{p.paydaysReceived}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y divide-surface-border/80">
        {players.map((p) => {
          const hasFaction = isFaction(p.factionId);
          const factionLabel = hasFaction ? getFactionLabel(p.factionId) : null;
          const jobLabel = formatJob(p.job);
          const meta = [factionLabel, jobLabel !== "—" ? jobLabel : null].filter(Boolean).join(" · ");
          return (
            <li key={p.username}>
              <Link
                href={profileHref(p.username)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/30 active:bg-surface-200/50 transition-colors"
              >
                <div className="relative w-10 h-10 rounded-xl bg-surface-200 border border-surface-border overflow-hidden shrink-0">
                  <GTAImage
                    src={getPedAvatarUrl(p.skin)}
                    alt=""
                    fallbackText={p.username.charAt(0).toUpperCase()}
                    className="w-full h-full object-cover object-top"
                  />
                  <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111114]" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#F2EFE8] truncate">{p.username}</span>
                    <span className="shrink-0 text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {t(locale, "home.online_status")}
                    </span>
                  </div>
                  <p className="text-xs text-[#8F8B83] mt-0.5">
                    {t(locale, "common.level")} {p.level}
                  </p>
                  {meta ? <p className="text-xs text-[#B4AFA4] mt-0.5 truncate capitalize">{meta}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
