"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User } from "lucide-react";

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
    }, 280);

    return () => clearTimeout(timeout);
  }, [query]);

  // Click outside listener
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
        <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-1.5 text-sm bg-surface-100 border border-surface-border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        {loading && (
          <Loader2 className="absolute right-3 w-4 h-4 text-brand animate-spin" />
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-100 border border-surface-border rounded-lg shadow-2xl py-1 z-50 max-h-72 overflow-y-auto">
          {results.length > 0 ? (
            results.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelect(res)}
                className="w-full text-left px-3.5 py-2 hover:bg-surface-50 flex items-center justify-between text-sm transition-colors border-b border-surface-border/50 last:border-b-0"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-border flex items-center justify-center text-brand">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-100">{res.name}</span>
                    <span className="text-xs text-gray-400 block">{res.job}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-border text-amber-400">
                  Lvl {res.level}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3.5 py-3 text-xs text-gray-400 text-center">
              No matching players found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
