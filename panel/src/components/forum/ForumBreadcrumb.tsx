import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ForumBreadcrumbProps {
  locale: Locale;
  items: BreadcrumbItem[];
}

export function ForumBreadcrumb({ locale, items }: ForumBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label={t(locale, "forumUi.breadcrumb_aria")}>
      <Link href="/forum" className="hover:text-foreground transition-colors">
        {t(locale, "forumUi.title")}
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
