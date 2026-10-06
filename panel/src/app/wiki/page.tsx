import {
  fetchFeaturedWikiArticles,
  fetchRecentWikiArticles,
  fetchWikiCategories,
  searchPublishedWikiArticles,
} from "@/lib/cms/wiki";
import { getViewerLocale } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { WikiHomeClient } from "./WikiHomeClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.wiki_title"),
    description: t(locale, "seo.wiki_description"),
    path: "/wiki",
  });
}

export default async function WikiHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = await getViewerLocale();
  const { q } = await searchParams;
  const query = (q || "").trim();

  const [categories, featured, recentOrSearch] = await Promise.all([
    fetchWikiCategories(locale),
    query ? Promise.resolve([]) : fetchFeaturedWikiArticles(locale),
    query
      ? searchPublishedWikiArticles(locale, query)
      : fetchRecentWikiArticles(locale),
  ]);

  return (
    <WikiHomeClient
      locale={locale}
      categories={categories}
      featured={featured}
      recent={recentOrSearch}
      initialQuery={query || undefined}
    />
  );
}
