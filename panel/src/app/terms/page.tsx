import { getViewerLocale } from "@/lib/auth";
import { LegalPublicPage, legalPageMetadata } from "@/components/cms/LegalPublicPage";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return legalPageMetadata("terms", locale);
}

export default async function TermsPage() {
  const locale = await getViewerLocale();
  return <LegalPublicPage pageKey="terms" locale={locale} />;
}
