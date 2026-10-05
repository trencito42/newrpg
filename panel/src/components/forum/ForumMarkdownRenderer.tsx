"use client";

interface ForumMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders pre-sanitised HTML from the server.
 * Content MUST be sanitised server-side before being passed to this component.
 */
export function ForumMarkdownRenderer({ content, className }: ForumMarkdownRendererProps) {
  return (
    <div
      className={[
        "prose prose-sm max-w-none",
        "prose-invert",
        "prose-p:text-foreground prose-p:my-2 prose-p:leading-relaxed",
        "prose-headings:text-foreground prose-headings:font-extrabold",
        "prose-strong:text-foreground",
        "prose-em:text-foreground/90",
        "prose-a:text-brand prose-a:no-underline hover:prose-a:underline",
        "prose-blockquote:border-l-brand prose-blockquote:bg-surface-200 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-lg prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
        "prose-code:bg-surface-300 prose-code:text-brand prose-code:px-1 prose-code:rounded prose-code:font-mono prose-code:text-xs",
        "prose-pre:bg-surface-300 prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-3",
        "prose-ul:my-2 prose-ol:my-2 prose-li:text-foreground",
        "prose-hr:border-border",
        "prose-img:rounded-lg prose-img:max-w-full",
        "prose-table:text-xs prose-th:bg-surface-200 prose-th:p-2 prose-td:p-2 prose-th:text-foreground prose-td:text-foreground",
        "[&_.text-brand]:text-brand",
        className ?? "",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
