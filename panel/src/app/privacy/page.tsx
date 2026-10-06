import { getViewerLocale } from "@/lib/auth";
import { LegalPublicPage, legalPageMetadata } from "@/components/cms/LegalPublicPage";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return legalPageMetadata("privacy", locale);
}

export default async function PrivacyPage() {
  const locale = await getViewerLocale();
  return <LegalPublicPage pageKey="privacy" locale={locale} />;
}
