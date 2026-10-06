"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PublicVehicleCardData } from "@/lib/vehicle-profile";
import { VehicleDetailsContent } from "./VehicleDetailsContent";

const POPOVER_W = 360;

export function VehicleProfileTrigger({
  locale,
  vehicle,
  children,
  className = "",
}: {
  locale: Locale;
  vehicle: PublicVehicleCardData;
  children: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  const isCoarsePointer = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

  const positionPopover = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = rect.left;
    let top = rect.bottom + margin;
    if (left + POPOVER_W > window.innerWidth - margin) {
      left = window.innerWidth - POPOVER_W - margin;
    }
    left = Math.max(margin, left);
    const estHeight = 420;
    if (top + estHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estHeight - margin);
    }
    setCoords({ top, left });
  }, []);

  const openDesktop = useCallback(() => {
    if (isCoarsePointer()) return;
    positionPopover();
    setOpen(true);
  }, [positionPopover]);

  const closeDesktop = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  const onPointerEnter = () => {
    if (isCoarsePointer()) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    hoverTimer.current = setTimeout(openDesktop, 120);
  };

  const onPointerLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    leaveTimer.current = setTimeout(closeDesktop, 160);
  };

  const onClick = () => {
    if (isCoarsePointer()) {
      setMobileOpen(true);
      return;
    }
    if (open) closeDesktop();
    else openDesktop();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDesktop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDesktop]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`text-left w-full cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/50 ${className}`}
        aria-expanded={open || mobileOpen}
        aria-haspopup="dialog"
        aria-labelledby={titleId}
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
        onFocus={openDesktop}
        onBlur={(e) => {
          if (!popoverRef.current?.contains(e.relatedTarget as Node)) {
            closeDesktop();
          }
        }}
        onClick={onClick}
      >
        {children}
      </button>

      {mounted && open && coords && !isCoarsePointer() && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-labelledby={titleId}
          className="hidden sm:block fixed z-[80] w-[min(360px,calc(100%-16px))] p-3.5 rounded-xl border border-white/[0.08] bg-[#121214] shadow-xl max-h-[min(85dvh,520px)] overflow-y-auto"
          style={{ top: coords.top, left: coords.left }}
          onMouseEnter={() => {
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
          }}
          onMouseLeave={onPointerLeave}
        >
          <span id={titleId} className="sr-only">
            {t(locale, "players.vehicle_details")} — {vehicle.displayName}
          </span>
          <VehicleDetailsContent locale={locale} vehicle={vehicle} />
        </div>,
        document.body,
      )}

      {mounted && mobileOpen && createPortal(
        <div className="sm:hidden fixed inset-0 z-[90] flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label={t(locale, "common.close")}
            onClick={() => setMobileOpen(false)}
          />
          <div
            role="dialog"
            aria-labelledby={titleId}
            className="relative max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-white/[0.08] bg-[#121214] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between mb-3">
              <span id={titleId} className="text-sm font-semibold text-[#F2EFE8]">
                {t(locale, "players.vehicle_details")}
              </span>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] px-3 text-xs font-semibold text-[#D7B558]"
                onClick={() => setMobileOpen(false)}
              >
                {t(locale, "common.close")}
              </button>
            </div>
            <VehicleDetailsContent locale={locale} vehicle={vehicle} large />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
