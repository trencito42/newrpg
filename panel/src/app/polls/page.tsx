import Link from "next/link";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { PollCountdown } from "@/components/polls/PollCountdown";
import { RowDataPacket } from "mysql2";

interface PollListRow extends RowDataPacket {
  id: number;
  title_en: string;
  title_ro: string;
  description_en: string | null;
  description_ro: string | null;
  status: "upcoming" | "active" | "closed" | "archived";
  starts_at: string;
  ends_at: string;
  minimum_level: number;
  total_votes: number;
  user_voted: boolean;
}

export default async function PollsPage() {
  const [locale, session] = await Promise.all([
    getViewerLocale(),
    getCurrentSession(),
  ]);

  const accountId = session?.accountId || 0;

  const polls = await dbQuery<PollListRow>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM panel_poll_votes WHERE poll_id = p.id) AS total_votes,
            EXISTS(SELECT 1 FROM panel_poll_votes WHERE poll_id = p.id AND account_id = ?) AS user_voted
     FROM panel_polls p
     ORDER BY (p.status = 'active') DESC, p.id DESC`,
    [accountId]
  );

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {t(locale, "polls.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {polls.map((p) => {
          const title = locale === "ro" ? p.title_ro : p.title_en;
          const desc = locale === "ro" ? p.description_ro : p.description_en;
          const isActive = p.status === "active";

          return (
            <Link
              key={p.id}
              href={`/polls/${p.id}`}
              className="p-3.5 bg-surface-100 hover:bg-surface-200 border border-surface-border rounded transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${isActive ? "text-emerald-400" : "text-[#6f6f74]"}`}>
                    {isActive ? "Active" : "Closed"}
                  </span>
                  {isActive ? (
                    <PollCountdown targetDate={p.ends_at} locale={locale} />
                  ) : (
                    <span className="text-[11px] text-[#6f6f74] font-mono">
                      Ended {formatDate(p.ends_at, locale, false)}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-[#f1f1f1] mt-2">
                  {title}
                </h3>
                {desc && (
                  <p className="text-xs text-[#8a8a90] mt-1 line-clamp-2">
                    {desc}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-surface-border/60 flex items-center justify-between text-xs text-[#6f6f74]">
                <span className="font-mono">
                  {t(locale, "polls.total_votes", { count: p.total_votes })}
                </span>
                {p.user_voted && (
                  <span className="text-emerald-400 font-medium">
                    {t(locale, "polls.voted_badge")}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        {polls.length === 0 && (
          <p className="text-xs text-[#6f6f74] p-4 border border-surface-border rounded bg-surface-100 col-span-2 text-center">
            No polls.
          </p>
        )}
      </div>
    </div>
  );
}
