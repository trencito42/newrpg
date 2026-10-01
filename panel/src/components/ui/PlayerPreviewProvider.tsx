"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatClanTag } from "./PlayerIdentity";
import { Shield, Award, User, Circle, ArrowRight } from "lucide-react";

interface PlayerPreviewData {
  username: string;
  avatarUrl: string | null;
  online: boolean;
  lastSeen: string | null;
  level: number;
  playtimeHours: number;
  job: string;
  faction: {
    id: string;
    name: string;
    color: string | null;
    rank: number;
  } | null;
  clan: {
    id: number;
    name: string;
    tag: string;
    color: string;
    tagStyle: string;
    rank: number;
    rankName: string;
  } | null;
  roles: {
    label: string;
    type: string;
    color?: string;
  }[];
}

const previewCache = new Map<string, { data: PlayerPreviewData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function PlayerPreviewProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PlayerPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number; placeAbove: boolean; placeLeft: boolean } | null>(null);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeCard = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setActiveUsername(null);
    setPreviewData(null);
    setCoords(null);
    currentTargetRef.current = null;
  }, []);

  const fetchPreview = useCallback(async (username: string) => {
    const key = username.toLowerCase();
    const cached = previewCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setPreviewData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/players/${encodeURIComponent(username)}/preview`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data: PlayerPreviewData = await res.json();
        previewCache.set(key, { data, timestamp: Date.now() });
        setPreviewData(data);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Preview fetch error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePointerEnter = useCallback(
    (e: PointerEvent | FocusEvent) => {
      // Ignore touch / coarse pointers
      if (e instanceof PointerEvent && e.pointerType === "touch") return;

      const target = (e.target as HTMLElement)?.closest("[data-player-preview]") as HTMLElement | null;
      if (!target) return;

      const username = target.getAttribute("data-player-preview");
      if (!username) return;

      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }

      if (currentTargetRef.current === target && activeUsername === username) {
        return;
      }

      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = setTimeout(() => {
        currentTargetRef.current = target;
        setActiveUsername(username);

        const rect = target.getBoundingClientRect();
        const cardWidth = 320;
        const cardHeight = 220;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceRight = window.innerWidth - rect.left;

        const placeAbove = spaceBelow < cardHeight && rect.top > cardHeight;
        const placeLeft = spaceRight < cardWidth;

        const x = placeLeft ? Math.max(16, rect.right - cardWidth) : Math.max(16, rect.left);
        const y = placeAbove ? rect.top - 8 : rect.bottom + 8;

        setCoords({ x, y, placeAbove, placeLeft });
        fetchPreview(username);
      }, 200); // 200ms intentional hover delay
    },
    [activeUsername, fetchPreview]
  );

  const handlePointerLeave = useCallback((e: PointerEvent | FocusEvent) => {
    const target = (e.target as HTMLElement)?.closest("[data-player-preview]") as HTMLElement | null;
    if (!target && !cardRef.current?.contains(e.relatedTarget as Node)) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        closeCard();
      }, 120); // 120ms leave grace period
    }
  }, [closeCard]);

  useEffect(() => {
    const handleDocumentPointerOver = (e: PointerEvent) => handlePointerEnter(e);
    const handleDocumentPointerOut = (e: PointerEvent) => handlePointerLeave(e);
    const handleDocumentFocusIn = (e: FocusEvent) => handlePointerEnter(e);
    const handleDocumentFocusOut = (e: FocusEvent) => handlePointerLeave(e);

    document.addEventListener("pointerover", handleDocumentPointerOver);
    document.addEventListener("pointerout", handleDocumentPointerOut);
    document.addEventListener("focusin", handleDocumentFocusIn);
    document.addEventListener("focusout", handleDocumentFocusOut);

    return () => {
      document.removeEventListener("pointerover", handleDocumentPointerOver);
      document.removeEventListener("pointerout", handleDocumentPointerOut);
      document.removeEventListener("focusin", handleDocumentFocusIn);
      document.removeEventListener("focusout", handleDocumentFocusOut);
    };
  }, [handlePointerEnter, handlePointerLeave]);

  return (
    <>
      {children}
      {mounted && activeUsername && coords && createPortal(
        <div
          ref={cardRef}
          onPointerEnter={() => {
            if (leaveTimerRef.current) {
              clearTimeout(leaveTimerRef.current);
              leaveTimerRef.current = null;
            }
          }}
          onPointerLeave={() => {
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = setTimeout(closeCard, 120);
          }}
          style={{
            position: "fixed",
            left: `${coords.x}px`,
            top: coords.placeAbove ? "auto" : `${coords.y}px`,
            bottom: coords.placeAbove ? `${window.innerHeight - coords.y}px` : "auto",
            zIndex: 99999,
          }}
          className="w-[320px] bg-[#101011] border border-surface-border rounded shadow-2xl p-3.5 text-xs text-[#f1f1f1] pointer-events-auto animate-in fade-in-0 duration-150"
        >
          {loading && !previewData ? (
            <div className="flex items-center justify-center py-6 text-xs text-[#6f6f74]">
              <span>Loading player...</span>
            </div>
          ) : previewData ? (
            <div className="space-y-3">
              {/* Top Row: Avatar + Name + Badges */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded bg-[#18181b] border border-surface-border shrink-0 overflow-hidden flex items-center justify-center">
                  {previewData.avatarUrl ? (
                    <img
                      src={previewData.avatarUrl}
                      alt={previewData.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-[#52525b]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 font-bold text-sm tracking-tight truncate">
                    {previewData.clan && (
                      <span style={{ color: previewData.clan.color }} className="font-mono">
                        {formatClanTag(previewData.clan.tag, previewData.clan.tagStyle).prefix}
                      </span>
                    )}
                    <span
                      style={
                        previewData.faction?.color
                          ? { color: previewData.faction.color }
                          : { color: "#f1f1f1" }
                      }
                    >
                      {previewData.username}
                    </span>
                    {previewData.clan && (
                      <span style={{ color: previewData.clan.color }} className="font-mono">
                        {formatClanTag(previewData.clan.tag, previewData.clan.tagStyle).suffix}
                      </span>
                    )}
                  </div>

                  {/* Badges */}
                  {previewData.roles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {previewData.roles.map((role, idx) => (
                        <span
                          key={idx}
                          style={{
                            borderColor: `${role.color || "#52525b"}40`,
                            color: role.color || "#f1f1f1",
                          }}
                          className="px-1.5 py-0.2 bg-[#1a1a1c] border rounded text-[9px] font-mono font-bold tracking-tight uppercase"
                        >
                          {role.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-[#8a8a90] mt-1 flex items-center gap-2">
                    <span className="font-mono font-medium">Level {previewData.level}</span>
                    <span>•</span>
                    <span className="font-mono">{previewData.playtimeHours}h played</span>
                  </div>
                </div>
              </div>

              {/* Middle Section: Faction & Clan */}
              <div className="space-y-1.5 pt-2 border-t border-surface-border text-[11px]">
                {previewData.faction ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[#6f6f74]">Faction:</span>
                    <span
                      style={{ color: previewData.faction.color || "#f1f1f1" }}
                      className="font-medium truncate max-w-[180px]"
                    >
                      {previewData.faction.name} (R{previewData.faction.rank})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-[#6f6f74]">Job:</span>
                    <span className="text-[#a5a5a8] capitalize">{previewData.job.replace(/_/g, " ")}</span>
                  </div>
                )}

                {previewData.clan && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#6f6f74]">Clan:</span>
                    <span style={{ color: previewData.clan.color }} className="font-medium truncate max-w-[180px]">
                      [{previewData.clan.tag}] {previewData.clan.name}
                    </span>
                  </div>
                )}

                {/* Online state */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[#6f6f74]">Status:</span>
                  {previewData.online ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                  ) : (
                    <span className="text-[#6f6f74]">
                      {previewData.lastSeen ? `Last seen ${new Date(previewData.lastSeen).toLocaleDateString()}` : "Offline"}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="pt-2 border-t border-surface-border flex items-center justify-end">
                <Link
                  href={`/players/${encodeURIComponent(previewData.username)}`}
                  className="inline-flex items-center gap-1 text-[11px] text-[#a5a5a8] hover:text-white transition-colors"
                >
                  <span>View profile</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
}
