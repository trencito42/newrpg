import React from "react";
import { ForumBreadcrumb } from "@/components/forum/ForumBreadcrumb";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Forum", // i18n-ignore: english-only seo
  description: "Community forum for RACKET RPG players.", // i18n-ignore: english-only seo
  path: "/forum",
});

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
