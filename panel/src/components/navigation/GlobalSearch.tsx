"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User, Shield, Flag, Newspaper, ArrowRight } from "lucide-react";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";

interface PlayerResult {
  type: "player";
  id: number;
  slug: string;
  name: string;
  characterName?: string | null;
  skin?: string | null;
  href: string;
  level: number;
  job: string;
  clanTag: string | null;
  clanColor: string | null;
  clanTagStyle: string | null;
}

interface GenericResult {
  type: "faction" | "clan" | "update";
  id: string | number;
  href: string;
  title: string;
  subtitle: string;
  color?: string;
}

export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [factions, setFactions] = useState<GenericResult[]>([]);
  const [clans, setClans] = useState<GenericResult[]>([]);
  const [updates, setUpdates] = useState<GenericResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setPlayers([]);
      setFactions([]);
      setClans([]);
      setUpdates([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.results || []);
          setFactions(data.factions || []);
          setClans(data.clans || []);
          setUpdates(data.updates || []);
          setOpen(true);
        }
      } catch {
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim().length >= 2) {
      setOpen(false);
      router.push(`/players?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const totalResults = players.length + factions.length + clans.length + updates.length;

  return (
    <div className="relative w-full max-w-xs md:max-w-md" ref={dropdownRef}>
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#8F8B83] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#0F0F12] border border-surface-border rounded-lg text-[#F2EFE8] placeholder-[#8F8B83] focus:outline-none focus:border-brand transition-colors shadow-inner"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 w-3.5 h-3.5 text-brand animate-spin" />
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#111114] border border-surface-border rounded-xl shadow-2xl py-2 z-50 max-h-96 overflow-y-auto space-y-2 divide-y divide-surface-border/40">
          {totalResults === 0 ? (
            <div className="px-4 py-3 text-xs text-[#8F8B83] text-center">
              Niciun rezultat găsit pentru „{query}”
            </div>
          ) : (
            <>
              {/* Players Section */}
              {players.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    <span>Jucători ({players.length})</span>
                  </div>

                  {players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleNavigate(p.href)}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-200/60 flex items-center justify-between text-xs transition-colors group"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-surface-200 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                          <GTAImage
                            src={getPedAvatarUrl(p.skin)}
                            alt={p.name}
                            fallbackText={p.name.charAt(0).toUpperCase()}
                            className="w-full h-full object-cover object-top"
                          />
                        </div>

                        <div className="min-w-0">
                          <PlayerIdentity
                            username={p.name}
                            factionId={p.job}
                            clanTag={p.clanTag}
                            clanColor={p.clanColor}
                            clanTagStyle={p.clanTagStyle}
                            clickable={false}
                            size="sm"
                          />
                          {p.characterName && (
                            <span className="text-[10px] text-[#8F8B83] block truncate">
                              {p.characterName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[10px] text-brand font-mono font-bold bg-brand/10 px-1.5 py-0.5 rounded">
                          L{p.level}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#5A5751] group-hover:text-brand transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Factions Section */}
              {factions.length > 0 && (
                <div className="pt-2 space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    <span>Facțiuni ({factions.length})</span>
                  </div>

                  {factions.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleNavigate(f.href)}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-200/60 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold text-[#F2EFE8] block">{f.title}</span>
                        <span className="text-[10px] text-[#8F8B83] block">{f.subtitle}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-[#5A5751]" />
                    </button>
                  ))}
                </div>
              )}

              {/* Clans Section */}
              {clans.length > 0 && (
                <div className="pt-2 space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Flag className="w-3 h-3" />
                    <span>Clanuri ({clans.length})</span>
                  </div>

                  {clans.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate(c.href)}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-200/60 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold text-[#F2EFE8] block">{c.title}</span>
                        <span className="text-[10px] text-[#8F8B83] block">{c.subtitle}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-[#5A5751]" />
                    </button>
                  ))}
                </div>
              )}

              {/* Updates Section */}
              {updates.length > 0 && (
                <div className="pt-2 space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Newspaper className="w-3 h-3" />
                    <span>Noutăți & Updates ({updates.length})</span>
                  </div>

                  {updates.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleNavigate(u.href)}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-200/60 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-[#F2EFE8] block truncate">{u.title}</span>
                        <span className="text-[10px] text-[#8F8B83] block">{u.subtitle}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-[#5A5751] shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Footer View All */}
              <div className="p-2 pt-2 bg-surface-100/50 text-center">
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push(`/players?q=${encodeURIComponent(query.trim())}`);
                  }}
                  className="text-[11px] font-bold text-brand hover:underline"
                >
                  Vezi toate rezultatele detaliate →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
