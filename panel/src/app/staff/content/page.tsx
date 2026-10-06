import Link from "next/link";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { BookOpen, FileText, Gavel, Megaphone, Vote } from "lucide-react";

export const dynamic = "force-dynamic";

const links = [
  { href: "/staff/content/wiki", icon: BookOpen, labelKey: "cmsUi.staff_hub_wiki" },
  { href: "/staff/content/legal", icon: FileText, labelKey: "cmsUi.staff_hub_legal" },
  { href: "/staff/content/rules", icon: Gavel, labelKey: "cmsUi.staff_hub_rules" },
  { href: "/staff/content/updates", icon: Megaphone, labelKey: "cmsUi.staff_hub_updates" },
  { href: "/staff/content/polls", icon: Vote, labelKey: "cmsUi.staff_hub_polls" },
] as const;

export default async function StaffContentHubPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "cmsUi.staff_content_title")}</h1>
        <p className="text-xs text-[#8F8B83] mt-1">{t(locale, "cmsUi.staff_content_subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-surface-border bg-surface-100 p-4 hover:bg-surface-200/60 transition-colors flex items-start gap-3"
            >
              <Icon className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <span className="text-sm font-semibold text-[#F2EFE8]">{t(locale, item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
