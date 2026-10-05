import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { PollsClientView, PollItem } from "./PollsClientView";
import { RowDataPacket } from "mysql2";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({ title: "Polls and elections", description: "Public RACKET RPG community polls and Los Santos elections.", path: "/polls" });

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
