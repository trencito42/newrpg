import { buildMetadata } from "@/lib/seo/metadata";
import { getViewerLocale } from "@/lib/auth";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "forumUi.new_topic"),
    path: "/forum/new-topic",
    noIndex: true,
  }, locale);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
