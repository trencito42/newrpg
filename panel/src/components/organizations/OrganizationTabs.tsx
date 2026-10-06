import Link from "next/link";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";

export type OrgTabItem = { id: string; label: string };

export function OrganizationTabs({
  basePath,
  tabs,
  activeTab,
  accentColor = "#D7B558",
  locale = "en",
}: {
  basePath: string;
  tabs: OrgTabItem[];
  activeTab: string;
  accentColor?: string;
  locale?: Locale;
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-white/[0.06] max-w-full pb-px"
      data-scroll-x="local"
      aria-label={t(locale, "orgUi.tabs_nav_aria")}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Link
            key={tab.id}
            href={tab.id === "overview" ? basePath : `${basePath}?tab=${tab.id}`}
            className={cn(
              "shrink-0 whitespace-nowrap px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px",
              active ? "text-[#F2EFE8]" : "text-[#8F8B83] border-transparent hover:text-[#B4AFA4]"
            )}
            style={active ? { borderBottomColor: accentColor } : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
