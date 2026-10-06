import { MarkdownDocument } from "@/components/cms/MarkdownDocument";
import { fetchPublishedLegalByKey } from "@/lib/cms/legal";
import { formatDate, t, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type LegalKey = "terms" | "privacy" | "refund" | "cookies";

const META: Record<
  LegalKey,
  { path: string; titleKey: string; descKey: string }
> = {
  terms: {
    path: "/terms",
    titleKey: "seo.terms_title",
    descKey: "seo.terms_description",
  },
  privacy: {
    path: "/privacy",
    titleKey: "seo.privacy_title",
    descKey: "seo.privacy_description",
  },
  refund: {
    path: "/refund",
    titleKey: "seo.refund_title",
    descKey: "seo.refund_description",
  },
  cookies: {
    path: "/cookies",
    titleKey: "seo.cookies_title",
    descKey: "seo.cookies_description",
  },
};

export function legalPageMetadata(key: LegalKey, locale: Locale): Metadata {
  const meta = META[key];
  return buildMetadata({
    title: t(locale, meta.titleKey),
    description: t(locale, meta.descKey),
    path: meta.path,
  });
}

export async function LegalPublicPage({
  pageKey,
  locale,
}: {
  pageKey: LegalKey;
  locale: Locale;
}) {
  const page = await fetchPublishedLegalByKey(pageKey, locale);
  if (!page) notFound();

  return (
    <div className="space-y-4 w-full">
      <div className="pb-2 border-b border-white/[0.06]">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{page.title}</h1>
        <p className="mt-1 text-xs text-[#8F8B83]">
          {page.effectiveAt
            ? t(locale, "cmsUi.legal_effective", { date: page.effectiveAt })
            : t(locale, "cmsUi.legal_updated", { date: formatDate(page.updatedAt, locale, false) })}
          {page.version > 1 ? ` · v${page.version}` : ""}
        </p>
      </div>
      <div className="max-w-3xl">
        <MarkdownDocument content={page.content} />
      </div>
    </div>
  );
}
