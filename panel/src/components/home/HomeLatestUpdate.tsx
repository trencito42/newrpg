import Link from "next/link";
import { ChevronRight, Flame, Newspaper } from "lucide-react";
import { Locale, formatDate, t } from "@/lib/i18n";

export interface HomeLatestUpdateData {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  author_name: string;
  is_pinned: number;
  created_at: string;
}

export function HomeLatestUpdate({
  locale,
  update,
}: {
  locale: Locale;
  update: HomeLatestUpdateData | null;
}) {
  if (!update) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper className="w-4 h-4 text-[#D7B558] shrink-0" aria-hidden />
          <h2 className="text-sm font-semibold text-[#F2EFE8]">{t(locale, "home.latest_update.title")}</h2>
        </div>
        <Link
          href="/updates"
          className="text-xs text-[#D7B558] hover:text-[#E3C572] font-medium flex items-center gap-0.5 shrink-0 transition-colors"
        >
          {t(locale, "home.latest_update.view_all")}
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>

      <Link
        href={`/updates/${update.slug}`}
        className="block rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0E0E10] p-4 hover:border-[rgba(215,181,88,0.25)] hover:bg-[#121214] transition-colors group"
      >
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#D7B558]/10 text-[#D7B558]">
            {update.category}
          </span>
          {update.is_pinned === 1 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
              <Flame className="w-3 h-3" aria-hidden />
              {t(locale, "interface.pinned")}
            </span>
          ) : null}
          <span className="text-[11px] text-[#8F8B83] font-mono ml-auto">{formatDate(update.created_at, locale)}</span>
        </div>
        <h3 className="text-base font-bold text-[#F2EFE8] group-hover:text-[#D7B558] transition-colors line-clamp-2">
          {update.title}
        </h3>
        <p className="text-sm text-[#99958E] mt-1.5 line-clamp-2 leading-relaxed">{update.summary}</p>
        <p className="text-xs text-[#8F8B83] mt-2">{update.author_name}</p>
      </Link>
    </section>
  );
}
