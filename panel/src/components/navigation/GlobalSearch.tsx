"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { PlayerName } from "@/components/ui/PlayerName";

interface SearchResult {
  id: number;
  slug: string;
  name: string;
  level: number;
  job: string;
}

export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setOpen(true);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

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

  const handleSelect = (res: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(`/players/${encodeURIComponent(res.slug || res.id)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim().length >= 2) {
      setOpen(false);
      router.push(`/players?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="relative w-full max-w-xs md:max-w-sm" ref={dropdownRef}>
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#6f6f74] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-8 pr-7 py-1 text-xs bg-surface-100 border border-surface-border rounded text-[#f1f1f1] placeholder-[#6f6f74] focus:outline-none focus:border-surface-borderLight transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 w-3.5 h-3.5 text-[#6f6f74] animate-spin" />
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-100 border border-surface-border rounded shadow-lg py-1 z-50 max-h-64 overflow-y-auto">
          {results.length > 0 ? (
            results.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelect(res)}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-200 flex items-center justify-between text-xs transition-colors border-b border-surface-border/40 last:border-b-0"
              >
                <div className="min-w-0 pr-2">
                  <PlayerName name={res.name} factionId={res.job} clickable={false} className="text-xs font-semibold block truncate" />
                  <span className="text-[11px] text-[#6f6f74] block">{res.job}</span>
                </div>
                <span className="text-[11px] text-[#6f6f74] font-mono">
                  L{res.level}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-[#6f6f74] text-center">
              No players found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
