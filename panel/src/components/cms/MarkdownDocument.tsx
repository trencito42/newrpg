import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { cn } from "@/lib/utils";

function extractToc(markdown: string): { id: string; text: string; level: number }[] {
  const items: { id: string; text: string; level: number }[] = [];
  for (const line of markdown.split("\n")) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const text = m[2].replace(/[#*`]/g, "").trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    items.push({ id, text, level: m[1].length });
  }
  return items;
}

export function MarkdownDocument({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const toc = extractToc(content);

  return (
    <div className={cn("flex flex-col lg:flex-row gap-6", className)}>
      {toc.length > 2 ? (
        <nav className="lg:w-48 shrink-0 text-xs text-[#8F8B83] space-y-1 lg:sticky lg:top-4 self-start">
          {toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "block hover:text-[#F2EFE8] transition-colors",
                item.level === 3 && "pl-3"
              )}
            >
              {item.text}
            </a>
          ))}
        </nav>
      ) : null}
      <div className="min-w-0 flex-1 prose-invert text-sm text-[#99958E] leading-relaxed">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}
