"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User, ChevronDown, Check, Loader2 } from "lucide-react";

interface CharacterOption {
  id: number;
  name: string;
  level: number;
}

export function CharacterSwitcher({
  characters,
  selectedId,
}: {
  characters: CharacterOption[];
  selectedId: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!characters || characters.length === 0) return null;

  const current = characters.find((c) => c.id === selectedId) || characters[0];

  const handleSelect = async (charId: number) => {
    if (charId === selectedId) {
      setOpen(false);
      return;
    }
    setOpen(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/switch-character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: charId }),
        });
        if (res.ok) {
          router.refresh();
        }
      } catch {
        // error handling
      }
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="flex items-center space-x-2 px-3 py-1.5 bg-surface-100 border border-surface-border hover:border-brand/50 rounded-lg text-xs font-medium text-gray-200 transition-all"
      >
        <User className="w-3.5 h-3.5 text-brand" />
        <span className="max-w-[110px] truncate">{current?.name || "Select Char"}</span>
        <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded border border-brand/20 font-bold">
          Lvl {current?.level || 1}
        </span>
        {isPending ? (
          <Loader2 className="w-3 h-3 text-brand animate-spin" />
        ) : (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-surface-100 border border-surface-border rounded-lg shadow-2xl py-1 z-50">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border">
            Switch Character
          </div>
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => handleSelect(char.id)}
              className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-surface-50 text-gray-200 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <span>{char.name}</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  (Lvl {char.level})
                </span>
              </div>
              {char.id === selectedId && <Check className="w-3.5 h-3.5 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
