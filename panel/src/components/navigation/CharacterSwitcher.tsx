"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        // ignore
      }
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="flex items-center space-x-1.5 px-2.5 py-1 bg-surface-200 border border-surface-border hover:border-surface-borderLight rounded text-xs text-[#f1f1f1] transition-colors"
      >
        <span className="max-w-[120px] truncate font-medium">{current?.name || "Character"}</span>
        <span className="text-[10px] text-[#6f6f74] font-mono">
          L{current?.level || 1}
        </span>
        {isPending ? (
          <Loader2 className="w-3 h-3 text-[#a5a5a8] animate-spin" />
        ) : (
          <ChevronDown className="w-3 h-3 text-[#6f6f74]" />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 bg-surface-100 border border-surface-border rounded shadow-lg py-1 z-50">
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => handleSelect(char.id)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors",
                char.id === selectedId
                  ? "bg-surface-200 text-[#f1f1f1]"
                  : "text-[#a5a5a8] hover:bg-surface-200 hover:text-[#f1f1f1]"
              )}
            >
              <span className="truncate">{char.name}</span>
              <span className="text-[10px] text-[#6f6f74] font-mono ml-2">
                L{char.level}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
