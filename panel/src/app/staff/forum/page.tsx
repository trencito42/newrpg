import Link from "next/link";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { ForumStaffAdmin } from "@/components/staff/forum/ForumStaffAdmin";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffForumPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "cmsUi.staff_forum_title")}</h1>
          <p className="text-xs text-[#8F8B83] mt-1">{t(locale, "cmsUi.staff_forum_subtitle")}</p>
        </div>
        <Link
          href="/staff/forum/moderation"
          className="rounded-lg border border-surface-border px-3 py-2 text-xs font-bold text-[#F2EFE8] hover:bg-surface-200"
        >
          {t(locale, "cmsUi.forum_moderation_link")}
        </Link>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-100 p-4">
        <h2 className="text-xs font-bold uppercase text-[#8F8B83] mb-3">{t(locale, "cmsUi.tab_structure")}</h2>
        <ForumStaffAdmin locale={locale} />
      </div>
    </div>
  );
}
