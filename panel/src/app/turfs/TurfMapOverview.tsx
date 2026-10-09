"use client";

import { useMemo } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { TurfCardData } from "./TurfsBrowser";

type Point = { x: number; y: number };

function parsePolygon(raw: TurfCardData["polygon"]): Point[] {
  if (!raw || !Array.isArray(raw) || raw.length < 3) return [];
  return raw.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function projectPoints(turfs: TurfCardData[]) {
  const all: Point[] = [];
  for (const turf of turfs) {
    all.push(...parsePolygon(turf.polygon));
  }
  if (all.length === 0) return null;
  let minX = all[0].x;
  let maxX = all[0].x;
  let minY = all[0].y;
  let maxY = all[0].y;
  for (const p of all) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = Math.max((maxX - minX) * 0.04, 40);
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}

export function TurfMapOverview({
  locale,
  turfs,
  highlightedId,
  onSelect,
}: {
  locale: Locale;
  turfs: TurfCardData[];
  highlightedId?: number | null;
  onSelect?: (id: number) => void;
}) {
  const bounds = useMemo(() => projectPoints(turfs), [turfs]);
  const paths = useMemo(() => {
    if (!bounds) return [];
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const toSvg = (p: Point) => ({
      x: ((p.x - bounds.minX) / w) * 1000,
      y: ((bounds.maxY - p.y) / h) * 560,
    });
    return turfs
      .map((turf) => {
        const pts = parsePolygon(turf.polygon);
        if (pts.length < 3) return null;
        const svgPts = pts.map(toSvg);
        const d = svgPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
        return { id: turf.id, d, color: turf.clan_color || "#8F8B83", controlled: !!turf.owner_clan_id };
      })
      .filter(Boolean) as { id: number; d: string; color: string; controlled: boolean }[];
  }, [turfs, bounds]);

  if (!bounds || paths.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-[#0E0E10] border border-white/[0.06] p-3 sm:p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">{t(locale, "turfs.map_title")}</h2>
        <span className="text-[10px] text-[#8F8B83] font-mono">{t(locale, "turfs.map_hint")}</span>
      </div>
      <div className="w-full overflow-hidden rounded-lg bg-[#08080A] border border-white/[0.04]">
        <svg viewBox="0 0 1000 560" className="w-full h-auto max-h-[min(52vh,420px)] touch-pan-y">
          <rect width="1000" height="560" fill="#0a0a0c" />
          {paths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              fill={path.controlled ? `${path.color}55` : "rgba(255,255,255,0.04)"}
              stroke={highlightedId === path.id ? "#D7B558" : path.controlled ? path.color : "#4a4a52"}
              strokeWidth={highlightedId === path.id ? 3 : 1.5}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={onSelect ? () => onSelect(path.id) : undefined}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
