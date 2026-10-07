"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bug,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  LucideIcon,
  MessageSquare,
  Newspaper,
  Rss,
  User,
} from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import {
  HorizontalCardScroller,
  horizontalCardSlideClass,
} from "@/components/ui/HorizontalCardScroller";

const ICONS: Record<string, LucideIcon> = {
  bug: Bug,
  forum: MessageSquare,
  feed: Rss,
  updates: Newspaper,
  support: LifeBuoy,
  activity: Activity,
  profile: User,
};

export interface CommunitySliderCard {
  id: string;
  href: string;
  titleKey: string;
  descriptionKey: string;
  ctaKey: string;
  hintKey?: string;
  icon: keyof typeof ICONS;
  iconClassName: string;
}

export function HomeCommunitySlider({
  locale,
  cards,
}: {
  locale: Locale;
  cards: CommunitySliderCard[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(true);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 2;
    setCanScrollBack(el.scrollLeft > 4);
    setCanScrollForward(el.scrollLeft < max);
  }, []);

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-community-card]");
    const step = card ? card.offsetWidth + 12 : 280;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  useEffect(() => {
    updateScrollHints();
    window.addEventListener("resize", updateScrollHints);
    return () => window.removeEventListener("resize", updateScrollHints);
  }, [updateScrollHints, cards.length]);

  const onWheel = (e: React.WheelEvent) => {
    const el = scrollerRef.current;
    if (!el || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
    updateScrollHints();
  };

  return (
    <section className="space-y-2.5" aria-labelledby="home-community-slider-title">
      <div>
        <h2
          id="home-community-slider-title"
          className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider"
        >
          {t(locale, "home.community_slider.title")}
        </h2>
        <p className="text-[11px] text-[#8F8B83] mt-0.5 leading-relaxed">
          {t(locale, "home.community_slider.subtitle")}
        </p>
      </div>

      <div className="relative max-sm:overflow-visible">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={!canScrollBack}
          aria-label={t(locale, "home.community_slider.scroll_prev")}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-lg bg-[#121214]/95 border border-[rgba(255,255,255,0.08)] text-[#F2EFE8] hover:border-[#D7B558]/40 disabled:opacity-0 disabled:pointer-events-none transition-opacity shadow-md"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={!canScrollForward}
          aria-label={t(locale, "home.community_slider.scroll_next")}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-lg bg-[#121214]/95 border border-[rgba(255,255,255,0.08)] text-[#F2EFE8] hover:border-[#D7B558]/40 disabled:opacity-0 disabled:pointer-events-none transition-opacity shadow-md"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <HorizontalCardScroller
          ref={scrollerRef}
          onScroll={updateScrollHints}
          onWheel={onWheel}
          trackClassName="overscroll-x-contain touch-pan-x sm:overflow-visible sm:snap-none"
        >
          {cards.map((card) => {
            const Icon = ICONS[card.icon] ?? MessageSquare;
            return (
              <Link
                key={card.id}
                href={card.href}
                data-community-card
                className={`${horizontalCardSlideClass} max-sm:w-[min(320px,calc(100vw-2*var(--panel-gutter)-var(--racket-hscroll-peek)))] sm:w-[min(300px,calc(33.33%-8px))] md:w-[min(280px,calc(25%-9px))] min-h-[168px] flex flex-col p-4 rounded-xl bg-[#0E0E10] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(215,181,88,0.35)] hover:bg-[#121214] transition-colors active:scale-[0.99]`}
              >
                <div
                  className={`w-9 h-9 rounded-lg bg-[#121214] border border-[rgba(255,255,255,0.06)] flex items-center justify-center mb-3 ${card.iconClassName}`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} aria-hidden />
                </div>

                <h3 className="text-[11px] font-bold text-[#F2EFE8] uppercase tracking-wide leading-snug">
                  {t(locale, card.titleKey)}
                </h3>

                <p className="text-xs text-[#8F8B83] mt-1.5 leading-relaxed flex-1">
                  {t(locale, card.descriptionKey)}
                </p>

                {card.hintKey ? (
                  <p className="text-[10px] text-[#8F8B83]/90 mt-2">{t(locale, card.hintKey)}</p>
                ) : null}

                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#D7B558] min-h-[44px]">
                  {t(locale, card.ctaKey)}
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </HorizontalCardScroller>
      </div>
    </section>
  );
}
