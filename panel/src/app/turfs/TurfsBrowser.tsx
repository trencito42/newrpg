"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { t, formatCurrency, type Locale } from "@/lib/i18n";

export type TurfCardData = {
  id: number;
  name: string;
  payout: number;
  owner_clan_id: number | null;
  clan_tag: string | null;
  clan_name: string | null;
  clan_color: string | null;
};

type Filter = "all" | "controlled" | "unclaimed";

export function TurfsBrowser({
  locale,
  turfs,
  controlledCount,
}: {
  locale: Locale;
  turfs: TurfCardData[];
  controlledCount: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return turfs.filter((turf) => {
      if (filter === "controlled" && !turf.owner_clan_id) return false;
      if (filter === "unclaimed" && turf.owner_clan_id) return false;
      if (!q) return true;
      const hay = `${turf.name} ${turf.clan_tag || ""} ${turf.clan_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [turfs, filter, query]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t(locale, "turfs.filter_all") },
    { id: "controlled", label: t(locale, "turfs.filter_controlled") },
    { id: "unclaimed", label: t(locale, "turfs.filter_unclaimed") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{t(locale, "turfs.title")}</h1>
          <p className="text-xs text-[#99958E] mt-1">
            {t(locale, "interface.18_contested_territories_across_san_andreas")}
          </p>
        </div>
        <span className="font-mono text-xs text-[#B4AFA4] bg-[#0E0E10] px-3 py-1.5 rounded-lg w-fit">
          {controlledCount} / {turfs.length} {t(locale, "interface.controlled")}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.id
                  ? "bg-[#D7B558]/15 text-[#D7B558] border border-[#D7B558]/30"
                  : "bg-[#0E0E10] text-[#8F8B83] border border-white/[0.06] hover:text-[#F2EFE8]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8F8B83]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(locale, "turfs.search_placeholder")}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0E0E10] border border-white/[0.06] text-sm text-[#F2EFE8] placeholder:text-[#8F8B83]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#8F8B83] text-center py-10 rounded-xl bg-[#0E0E10]">
          {t(locale, "turfs.no_matches")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
          {filtered.map((turf) => {
            const isControlled = turf.owner_clan_id !== null;
            return (
              <div key={turf.id} className="p-3.5 sm:p-4 bg-[#0E0E10] rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-[#8F8B83] uppercase tracking-wider">
                      {t(locale, "interface.territory")} #{turf.id}
                    </span>
                    <span className="font-mono text-xs text-[#D7B558]">
                      {formatCurrency(turf.payout)} {t(locale, "interface.hr")}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#F2EFE8] mt-1.5 leading-snug">{turf.name}</h3>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex items-center justify-between text-xs text-[#8F8B83]">
                  <span>{t(locale, "interface.clan")}</span>
                  {isControlled && turf.owner_clan_id ? (
                    <Link
                      href={`/clans/${turf.owner_clan_id}`}
                      className="font-semibold hover:underline"
                      style={{ color: turf.clan_color || "#F2EFE8" }}
                    >
                      [{turf.clan_tag || turf.clan_name}]
                    </Link>
                  ) : (
                    <span className="text-[#8F8B83] italic">{t(locale, "interface.unclaimed")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
