import Link from "next/link";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Vote, ArrowRight, CheckCircle2 } from "lucide-react";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {t(locale, "polls.title")}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {t(locale, "polls.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {polls.map((p) => {
          const title = locale === "ro" ? p.title_ro : p.title_en;
          const desc = locale === "ro" ? p.description_ro : p.description_en;
          const isActive = p.status === "active";

          return (
            <Card
              key={p.id}
              className="flex flex-col justify-between hover:border-surface-borderLight transition-all"
            >
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={isActive ? "brand" : "default"}>
                      {p.status.toUpperCase()}
                    </Badge>
                    {isActive ? (
                      <PollCountdown targetDate={p.ends_at} locale={locale} />
                    ) : (
                      <span className="text-[11px] text-gray-500 font-mono">
                        Closed on {formatDate(p.ends_at, locale, false)}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{title}</CardTitle>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {desc}
                  </p>
                </CardHeader>

                <CardContent className="pt-2 text-xs text-gray-400 flex items-center justify-between">
                  <span className="font-mono">
                    {t(locale, "polls.total_votes", { count: p.total_votes })}
                  </span>
                  {p.user_voted && (
                    <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t(locale, "polls.voted_badge")}</span>
                    </span>
                  )}
                </CardContent>
              </div>

              <div className="pt-3 mt-3 border-t border-surface-border flex items-center justify-end">
                <Link
                  href={`/polls/${p.id}`}
                  className="inline-flex items-center space-x-1 text-xs text-brand hover:underline font-semibold"
                >
                  <span>{isActive ? "View & Vote" : "View Results"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
