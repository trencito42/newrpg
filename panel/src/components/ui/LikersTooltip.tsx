"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getFactionColor } from "@/lib/factions";
import { formatClanTag } from "@/lib/clan-tag";

interface Liker {
  display_name?: string;
  firstname?: string;
  lastname?: string;
  username: string;
  faction_id: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  clan_tag_style: string | null;
}

interface LikersTooltipProps {
  count: number;
  fetchUrl: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function LikersTooltip({ count, fetchUrl, children, disabled }: LikersTooltipProps) {
  const [open, setOpen] = useState(false);
  const [likers, setLikers] = useState<Liker[] | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (disabled || count === 0) return;
    timerRef.current = setTimeout(async () => {
      setOpen(true);
      if (likers === null && !loading) {
        setLoading(true);
        try {
          const res = await fetch(fetchUrl);
          if (res.ok) {
            const data = await res.json();
            setLikers(data.likers || []);
          }
        } catch {
          setLikers([]);
        } finally {
          setLoading(false);
        }
      }
    }, 300);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {open && count > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[160px] max-w-[220px] bg-[#111113] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-xl p-2 text-xs">
          <div className="text-[10px] text-[#8F8B83] font-semibold uppercase tracking-wider mb-1.5 px-1">
            {count} {count === 1 ? "like" : "likes"}
          </div>
          {loading && <p className="text-[#8F8B83] px-1 py-1">...</p>}
          {likers && likers.length === 0 && (
            <p className="text-[#8F8B83] px-1 py-1">—</p>
          )}
          {likers && likers.map((l, i) => {
            const name = l.display_name ?? `${l.firstname ?? ""} ${l.lastname ?? ""}`.trim();
            const factionColor = getFactionColor(l.faction_id);
            const resolvedClanColor = l.clan_color || "#f59e0b";
            const { prefix, suffix } = l.clan_tag
              ? formatClanTag(l.clan_tag, l.clan_tag_style)
              : { prefix: "", suffix: "" };

            return (
              <Link
                key={i}
                href={`/players/${encodeURIComponent(l.username)}`}
                className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                onClick={hide}
              >
                <span className="inline-flex items-center leading-none font-medium truncate">
                  {prefix && <span style={{ color: resolvedClanColor }} className="font-mono font-bold">{prefix}</span>}
                  <span style={factionColor ? { color: factionColor } : undefined} className={factionColor ? "" : "text-[#D4CFC8]"}>
                    {name}
                  </span>
                  {suffix && <span style={{ color: resolvedClanColor }} className="font-mono font-bold">{suffix}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
