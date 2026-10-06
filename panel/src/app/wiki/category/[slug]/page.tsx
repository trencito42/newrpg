import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchWikiArticlesByCategory,
  fetchWikiCategories,
} from "@/lib/cms/wiki";
import { getViewerLocale } from "@/lib/auth";
import { formatDate, t } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getViewerLocale();
  const { slug } = await params;
  const categories = await fetchWikiCategories(locale);
  const cat = categories.find((c) => c.slug === slug);
  return buildMetadata({
    title: cat?.name || t(locale, "nav.wiki"),
    description: cat?.description || t(locale, "seo.wiki_description"),
    path: `/wiki/category/${slug}`,
  });
}

export default async function WikiCategoryPage({ params }: Props) {
  const locale = await getViewerLocale();
  const { slug } = await params;
  const categories = await fetchWikiCategories(locale);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const articles = await fetchWikiArticlesByCategory(slug, locale);

  return (
    <div className="space-y-4 w-full">
      <div className="text-xs text-[#8F8B83]">
        <Link href="/wiki" className="hover:text-[#F2EFE8]">
          {t(locale, "nav.wiki")}
        </Link>
        <span> / </span>
        <span className="text-[#F2EFE8]">{category.name}</span>
      </div>
      <div>
        <h1 className="text-xl font-bold text-[#F2EFE8]">{category.name}</h1>
        {category.description ? (
          <p className="mt-1 text-xs text-[#99958E]">{category.description}</p>
        ) : null}
      </div>
      {articles.length === 0 ? (
        <p className="text-xs text-[#8F8B83] rounded-xl bg-[#0E0E10] p-4">{t(locale, "cmsUi.wiki_empty")}</p>
      ) : (
        <ul className="rounded-xl bg-[#0E0E10] divide-y divide-white/[0.04]">
          {articles.map((article) => (
            <li key={article.id}>
              <Link
                href={`/wiki/${article.slug}`}
                className="block px-4 py-3 hover:bg-[#141418] transition-colors"
              >
                <div className="text-sm font-semibold text-[#F2EFE8]">{article.title}</div>
                <p className="text-[10px] text-[#8F8B83] mt-1">
                  {formatDate(article.updatedAt, locale, false)}
                </p>
                {article.summary ? (
                  <p className="text-xs text-[#99958E] mt-1 line-clamp-2">{article.summary}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
