import { cn } from "@/lib/utils";
import {
  forwardRef,
  type ReactNode,
  type UIEventHandler,
  type WheelEventHandler,
} from "react";

/** Shared class for snap children inside {@link HorizontalCardScroller}. */
export const horizontalCardSlideClass =
  "racket-hscroll-slide max-sm:snap-start max-sm:shrink-0";

type HorizontalCardScrollerProps = {
  children: ReactNode;
  /** Extra classes on the bleed wrapper (mobile only). */
  className?: string;
  /** Applied to the scroll track; use `sm:grid …` for desktop layouts. */
  trackClassName?: string;
  gap?: "sm" | "md";
  onScroll?: UIEventHandler<HTMLDivElement>;
  onWheel?: WheelEventHandler<HTMLDivElement>;
};

/**
 * Mobile horizontal card strip aligned to the main page gutter (16px).
 * Desktop: pass grid/flex classes via `trackClassName` — bleed and scroll snap are disabled from `sm`.
 */
export const HorizontalCardScroller = forwardRef<HTMLDivElement, HorizontalCardScrollerProps>(
  function HorizontalCardScroller(
    { children, className, trackClassName, gap = "sm", onScroll, onWheel },
    ref
  ) {
    const gapClass = gap === "md" ? "gap-4" : "gap-3";

    return (
      <div className={cn("racket-hscroll-outer", className)}>
        <div
          ref={ref}
          className={cn(
            "racket-hscroll-track flex max-w-full py-1 no-scrollbar scroll-smooth",
            "max-sm:snap-x max-sm:snap-mandatory",
            gapClass,
            trackClassName
          )}
          data-scroll-x="local"
          onScroll={onScroll}
          onWheel={onWheel}
        >
          {children}
        </div>
      </div>
    );
  }
);
