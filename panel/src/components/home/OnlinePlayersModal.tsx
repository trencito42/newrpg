"use client";

import { useEffect, useId, useRef } from "react";
import { X, Users } from "lucide-react";
import { useViewerLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import type { OnlinePlayersPayload } from "@/lib/online-players";
import { OnlinePlayersList } from "./OnlinePlayersList";

interface OnlinePlayersModalProps {
  open: boolean;
  onClose: () => void;
  data: OnlinePlayersPayload | null;
  loading: boolean;
}

export function OnlinePlayersModal({ open, onClose, data, loading }: OnlinePlayersModalProps) {
  const locale = useViewerLocale();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const playerCount = data?.fresh ? data.playerCount : 0;
  const players = data?.fresh ? data.players : [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 max-sm:items-end max-sm:p-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-2xl bg-[#111114] border border-surface-border rounded-xl max-sm:rounded-b-none max-sm:rounded-t-2xl shadow-2xl flex flex-col max-h-[min(88dvh,720px)] max-sm:max-h-[85dvh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5 border-b border-surface-border bg-surface-100/40 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <Users className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-[#F2EFE8]">
                {t(locale, "home.online_players_title")}
              </h2>
              <p className="text-[11px] text-[#8F8B83] mt-0.5">
                {t(locale, "home.online_players_count", { count: playerCount })}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-surface-200 transition-colors shrink-0"
            aria-label={t(locale, "common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <OnlinePlayersList locale={locale} players={players} loading={loading && !data} />
        </div>
      </div>
    </div>
  );
}
