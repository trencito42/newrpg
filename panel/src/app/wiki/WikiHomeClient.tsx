"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { t, formatDate, type Locale } from "@/lib/i18n";
import type { WikiArticlePublic, WikiCategoryPublic } from "@/lib/cms/wiki";
import { cn } from "@/lib/utils";

export function WikiHomeClient({
  locale,
  categories,
  featured,
  recent,
  initialQuery,
}: {
  locale: Locale;
  categories: WikiCategoryPublic[];
  featured: WikiArticlePublic[];
  recent: WikiArticlePublic[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? "");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/wiki?q=${encodeURIComponent(q)}` : "/wiki");
  };

  return (
    <div className="space-y-4 w-full">
      <div>
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{t(locale, "nav.wiki")}</h1>
        <p className="mt-1 text-xs text-[#99958E]">{t(locale, "cmsUi.wiki_subtitle")}</p>
      </div>

      <form onSubmit={onSearch} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8F8B83]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, "cmsUi.wiki_search_placeholder")}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0E0E10] border border-white/[0.06] text-sm text-[#F2EFE8] placeholder:text-[#8F8B83]"
        />
      </form>

      {initialQuery ? (
        <p className="text-xs text-[#8F8B83]">
          {t(locale, "cmsUi.wiki_search_results_for", { query: initialQuery })}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#F2EFE8]">{t(locale, "cmsUi.wiki_categories")}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/wiki/category/${cat.slug}`}
              className="rounded-xl bg-[#0E0E10] p-3 hover:bg-[#141418] transition-colors border border-white/[0.04]"
            >
              <div className="text-sm font-semibold text-[#F2EFE8]">{cat.name}</div>
              {cat.description ? (
                <p className="text-xs text-[#8F8B83] mt-1 line-clamp-2">{cat.description}</p>
              ) : null}
              <p className="text-[10px] text-[#8F8B83] mt-2 font-mono">
                {t(locale, "cmsUi.wiki_article_count", { count: cat.articleCount })}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-[#F2EFE8]">{t(locale, "cmsUi.wiki_featured")}</h2>
          <ArticleList locale={locale} articles={featured} highlight />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#F2EFE8]">{t(locale, "cmsUi.wiki_recent")}</h2>
        {recent.length === 0 ? (
          <p className="text-xs text-[#8F8B83] rounded-xl bg-[#0E0E10] p-4">{t(locale, "cmsUi.wiki_empty")}</p>
        ) : (
          <ArticleList locale={locale} articles={recent} />
        )}
      </section>
    </div>
  );
}

function ArticleList({
  locale,
  articles,
  highlight,
}: {
  locale: Locale;
  articles: WikiArticlePublic[];
  highlight?: boolean;
}) {
  return (
    <ul className="rounded-xl bg-[#0E0E10] divide-y divide-white/[0.04] overflow-hidden">
      {articles.map((article) => (
        <li key={article.id}>
          <Link
            href={`/wiki/${article.slug}`}
            className={cn(
              "block px-4 py-3 hover:bg-[#141418] transition-colors",
              highlight && article.isFeatured && "border-l-2 border-brand"
            )}
          >
            <div className="text-sm font-semibold text-[#F2EFE8]">{article.title}</div>
            <div className="flex flex-wrap gap-x-2 text-[10px] text-[#8F8B83] mt-1">
              <span>{article.categoryName}</span>
              <span>·</span>
              <span>{formatDate(article.updatedAt, locale, false)}</span>
            </div>
            {article.summary ? (
              <p className="text-xs text-[#99958E] mt-1 line-clamp-2">{article.summary}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
