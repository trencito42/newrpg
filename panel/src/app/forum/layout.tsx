import React from "react";
import { ForumBreadcrumb } from "@/components/forum/ForumBreadcrumb";
import { buildMetadata } from "@/lib/seo/metadata";
import { getViewerLocale } from "@/lib/auth";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.forum_title"),
    description: t(locale, "seo.forum_description"),
    path: "/forum",
  });
}

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-12">
      <div className="py-4 mb-2">
        <ForumBreadcrumb items={[]} />
      </div>
      {children}
    </div>
  );
}
