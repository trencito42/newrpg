import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ForumBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function ForumBreadcrumb({ items }: ForumBreadcrumbProps) {
  return ( // i18n-ignore: english-only
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/forum" className="hover:text-foreground transition-colors">
        {/* i18n-ignore: english-only */}
        Forum
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
