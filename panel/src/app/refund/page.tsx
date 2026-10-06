import { getViewerLocale } from "@/lib/auth";
import { LegalPublicPage, legalPageMetadata } from "@/components/cms/LegalPublicPage";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return legalPageMetadata("refund", locale);
}

export default async function RefundPage() {
  const locale = await getViewerLocale();
  return <LegalPublicPage pageKey="refund" locale={locale} />;
}
