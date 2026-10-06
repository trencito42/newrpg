import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { t } from "@/lib/i18n";
import { StaffPollsClient } from "./StaffPollsClient";

export const dynamic = "force-dynamic";

interface PollRow extends RowDataPacket {
  id: number;
  title_en: string;
  status: string;
  ends_at: string;
}

export default async function StaffContentPollsPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  const polls = await dbQuery<PollRow>(
    `SELECT id, title_en, status, ends_at FROM panel_polls ORDER BY id DESC LIMIT 50`
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "cmsUi.staff_polls_title")}</h1>
          <p className="text-xs text-[#8F8B83] mt-1">
            <Link href="/polls" className="text-brand hover:underline">
              {t(locale, "cmsUi.view_public_polls")}
            </Link>
          </p>
        </div>
        <Link
          href="/polls?create=1"
          className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-[#08080A]"
        >
          {t(locale, "cmsUi.create_poll")}
        </Link>
      </div>

      <StaffPollsClient
        locale={locale}
        polls={polls.map((p) => ({
          id: p.id,
          title_en: p.title_en,
          status: p.status,
          ends_at: p.ends_at,
        }))}
      />
    </div>
  );
}
