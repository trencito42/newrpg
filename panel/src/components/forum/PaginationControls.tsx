"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  locale?: "en" | "ro";
}

export function PaginationControls({ page, totalPages, buildHref, locale = "en" }: PaginationControlsProps) {
  const router = useRouter();

  if (totalPages <= 1) return null;

  // Compute page window
  const WINDOW = 5;
  let start = Math.max(1, page - Math.floor(WINDOW / 2));
  const end = Math.min(totalPages, start + WINDOW - 1);
  if (end - start + 1 < WINDOW) start = Math.max(1, end - WINDOW + 1);

  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination"> // i18n-ignore: english-only
      {page > 1 && (
        <button
          onClick={() => router.push(buildHref(page - 1))}
          className="p-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={"Previous"} // i18n-ignore: english-only
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {start > 1 && (
        <>
          <button
            onClick={() => router.push(buildHref(1))}
            className="px-2.5 py-1 text-xs rounded-lg bg-surface-200 hover:bg-surface-300 text-foreground transition-colors"
          >
            1
          </button>
          {start > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => router.push(buildHref(p))}
          className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
            p === page
              ? "bg-brand text-[#08080A] font-bold"
              : "bg-surface-200 hover:bg-surface-300 text-foreground"
          }`}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
          <button
            onClick={() => router.push(buildHref(totalPages))}
            className="px-2.5 py-1 text-xs rounded-lg bg-surface-200 hover:bg-surface-300 text-foreground transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}

      {page < totalPages && (
        <button
          onClick={() => router.push(buildHref(page + 1))}
          className="p-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={"Next"} // i18n-ignore: english-only
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </nav>
  );
}
