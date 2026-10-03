"use client";

import { useMemo } from "react";
import { marked } from "marked";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      // Configure marked
      marked.setOptions({
        gfm: true,
        breaks: true,
      });
      return marked.parse(content) as string;
    } catch (e) {
      console.error("Markdown parse error:", e);
      return `<p class="text-red-400">Eroare la randarea textului Markdown.</p>`;
    }
  }, [content]);

  return (
    <div
      className={`prose prose-invert max-w-none text-[#E6E4DD] text-sm leading-relaxed
        [&>h1]:text-2xl [&>h1]:font-black [&>h1]:text-[#F2EFE8] [&>h1]:tracking-tight [&>h1]:mt-8 [&>h1]:mb-4 [&>h1]:border-b [&>h1]:border-surface-border [&>h1]:pb-2
        [&>h2]:text-xl [&>h2]:font-extrabold [&>h2]:text-brand [&>h2]:tracking-tight [&>h2]:mt-6 [&>h2]:mb-3
        [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-[#F2EFE8] [&>h3]:mt-5 [&>h3]:mb-2
        [&>h4]:text-base [&>h4]:font-semibold [&>h4]:text-brand-300 [&>h4]:mt-4 [&>h4]:mb-2
        [&>p]:my-3 [&>p]:leading-relaxed
        [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:my-3 [&>ul]:space-y-1.5 [&>ul>li]:text-[#D8D4CA]
        [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:my-3 [&>ol]:space-y-1.5 [&>ol>li]:text-[#D8D4CA]
        [&>blockquote]:border-l-4 [&>blockquote]:border-brand [&>blockquote]:bg-surface-100/80 [&>blockquote]:py-2 [&>blockquote]:px-4 [&>blockquote]:rounded-r-lg [&>blockquote]:italic [&>blockquote]:text-[#B4AFA4] [&>blockquote]:my-4
        [&>pre]:bg-[#08080A] [&>pre]:border [&>pre]:border-surface-border [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:my-4 [&>pre]:text-xs [&>pre]:font-mono [&>pre]:text-emerald-400
        [&>code]:bg-surface-200 [&>code]:text-brand-300 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs [&>code]:font-mono
        [&>table]:w-full [&>table]:border-collapse [&>table]:my-4 [&>table]:text-left [&>table]:text-xs
        [&>table_th]:bg-surface-200 [&>table_th]:p-2.5 [&>table_th]:border [&>table_th]:border-surface-border [&>table_th]:font-bold [&>table_th]:text-[#F2EFE8]
        [&>table_td]:p-2.5 [&>table_td]:border [&>table_td]:border-surface-border [&>table_td]:text-[#B4AFA4]
        [&>hr]:border-surface-border [&>hr]:my-6
        [&>a]:text-brand [&>a]:underline [&>a]:underline-offset-4 hover:[&>a]:text-brand-300
        [&>img]:rounded-lg [&>img]:border [&>img]:border-surface-border [&>img]:my-4 [&>img]:max-h-[480px] [&>img]:object-cover [&>img]:w-full
        ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
