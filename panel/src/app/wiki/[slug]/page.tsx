import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownDocument } from "@/components/cms/MarkdownDocument";
import { fetchPublishedWikiArticle } from "@/lib/cms/wiki";
import { getViewerLocale } from "@/lib/auth";
import { formatDate, t } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { getSiteUrl } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getViewerLocale();
  const { slug } = await params;
  const article = await fetchPublishedWikiArticle(slug, locale);
  if (!article) {
    return buildMetadata({ title: t(locale, "nav.wiki"), path: "/wiki", noIndex: true });
  }
  return buildMetadata({
    title: article.title,
    description: article.summary || t(locale, "seo.wiki_description"),
    path: `/wiki/${article.slug}`,
    type: "article",
  });
}

export default async function WikiArticlePage({ params }: Props) {
  const locale = await getViewerLocale();
  const { slug } = await params;
  const article = await fetchPublishedWikiArticle(slug, locale);
  if (!article) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    dateModified: article.updatedAt,
    datePublished: article.publishedAt ?? article.updatedAt,
    url: getSiteUrl(`/wiki/${article.slug}`),
  };

  return (
    <div className="space-y-4 w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="text-xs text-[#8F8B83] flex flex-wrap items-center gap-1">
        <Link href="/wiki" className="hover:text-[#F2EFE8]">
          {t(locale, "nav.wiki")}
        </Link>
        <span>/</span>
        <Link href={`/wiki/category/${article.categorySlug}`} className="hover:text-[#F2EFE8]">
          {article.categoryName}
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{article.title}</h1>
        <p className="mt-1 text-xs text-[#8F8B83]">
          {t(locale, "cmsUi.wiki_updated", { date: formatDate(article.updatedAt, locale) })}
        </p>
        {article.summary ? (
          <p className="mt-2 text-sm text-[#99958E] max-w-3xl">{article.summary}</p>
        ) : null}
      </div>
      <div className="max-w-3xl">
        <MarkdownDocument content={article.content} />
      </div>
    </div>
  );
}
