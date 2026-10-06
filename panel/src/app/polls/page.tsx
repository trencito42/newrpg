import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { PollsClientView, PollItem } from "./PollsClientView";
import { RowDataPacket } from "mysql2";
import { buildMetadata } from "@/lib/seo/metadata";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.polls_title"),
    description: t(locale, "seo.polls_description"),
    path: "/polls",
  }, locale);
}

export default async function PollsPage() {
  const [locale, session] = await Promise.all([
    getViewerLocale(),
    getCurrentSession(),
  ]);

  const accountId = session?.accountId || 0;
  const canCreate = Boolean(session && session.adminLevel >= 1);

  const polls = await dbQuery<PollItem & RowDataPacket>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM panel_poll_votes WHERE poll_id = p.id) AS total_votes,
            EXISTS(SELECT 1 FROM panel_poll_votes WHERE poll_id = p.id AND account_id = ?) AS user_voted
     FROM panel_polls p
     ORDER BY (p.status = 'active') DESC, p.id DESC`,
    [accountId]
  );

  return (
    <div className="w-full space-y-5">
      <PollsClientView
        polls={polls}
        canCreate={canCreate}
        locale={locale}
      />
    </div>
  );
}
