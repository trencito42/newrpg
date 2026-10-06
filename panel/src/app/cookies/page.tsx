import { getViewerLocale } from "@/lib/auth";
import { LegalPublicPage, legalPageMetadata } from "@/components/cms/LegalPublicPage";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return legalPageMetadata("cookies", locale);
}

export default async function CookiesPage() {
  const locale = await getViewerLocale();
  return <LegalPublicPage pageKey="cookies" locale={locale} />;
}
