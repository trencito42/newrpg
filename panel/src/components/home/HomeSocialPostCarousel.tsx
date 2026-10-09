"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronRight as ChevronRightSmall } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import { HorizontalCardScroller } from "@/components/ui/HorizontalCardScroller";
import { HomeSocialPreviewCard } from "./HomeSocialPreviewCard";

export function HomeSocialPostCarousel({
  locale,
  posts,
  isLoggedIn,
}: {
  locale: Locale;
  posts: FeedPost[];
  isLoggedIn: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 2;
    setCanScrollBack(el.scrollLeft > 4);
    setCanScrollForward(max > 4 && el.scrollLeft < max);
  }, []);

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-social-preview-card]");
    const step = card ? card.offsetWidth + 12 : 300;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  useEffect(() => {
    updateScrollHints();
    window.addEventListener("resize", updateScrollHints);
    return () => window.removeEventListener("resize", updateScrollHints);
  }, [updateScrollHints, posts.length]);

  const onWheel = (e: React.WheelEvent) => {
    const el = scrollerRef.current;
    if (!el || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
    updateScrollHints();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByCard(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByCard(1);
    }
  };

  if (posts.length === 0) {
    return (
      <p className="text-sm text-[#8F8B83] py-4">{t(locale, "community.no_activity")}</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#F2EFE8]">{t(locale, "community.for_you_feed")}</h3>
          {isLoggedIn ? (
            <Link
              href="/feed"
              className="text-[11px] text-[#8F8B83] hover:text-[#D7B558] transition-colors mt-0.5 inline-block"
            >
              {t(locale, "home.whats_happening")}
            </Link>
          ) : null}
        </div>
        <Link
          href="/feed"
          className="text-xs text-[#D7B558] hover:text-[#E3C572] font-medium inline-flex items-center gap-0.5 transition-colors min-h-[44px] px-1"
        >
          {t(locale, "community.view_all_feed")}
          <ChevronRightSmall className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>

      <div
        className="relative"
        role="region"
        aria-roledescription="carousel"
        aria-label={t(locale, "community.for_you_feed")}
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={!canScrollBack}
          aria-label={t(locale, "home.community_slider.scroll_prev")}
          className="hidden md:flex absolute -left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-lg bg-[#121214]/95 border border-[rgba(255,255,255,0.08)] text-[#F2EFE8] hover:border-[rgba(255,255,255,0.16)] disabled:opacity-0 disabled:pointer-events-none transition-opacity"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={!canScrollForward}
          aria-label={t(locale, "home.community_slider.scroll_next")}
          className="hidden md:flex absolute -right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-lg bg-[#121214]/95 border border-[rgba(255,255,255,0.08)] text-[#F2EFE8] hover:border-[rgba(255,255,255,0.16)] disabled:opacity-0 disabled:pointer-events-none transition-opacity"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <HorizontalCardScroller
          ref={scrollerRef}
          onScroll={updateScrollHints}
          onWheel={onWheel}
          gap="md"
          trackClassName="overflow-x-auto overscroll-x-contain snap-x snap-mandatory max-sm:snap-mandatory md:pb-0.5"
        >
          {posts.map((post) => (
            <HomeSocialPreviewCard key={post.id} post={post} locale={locale} />
          ))}
        </HorizontalCardScroller>
      </div>
    </div>
  );
}
