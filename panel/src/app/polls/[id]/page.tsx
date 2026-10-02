import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { PollCountdown } from "@/components/polls/PollCountdown";
import { PollVoteForm } from "@/components/polls/PollVoteForm";
import { RowDataPacket } from "mysql2";

interface PollRow extends RowDataPacket {
  id: number;
  title_en: string;
  title_ro: string;
  description_en: string | null;
  description_ro: string | null;
  status: "upcoming" | "active" | "closed" | "archived";
  starts_at: string;
  ends_at: string;
  minimum_level: number;
  minimum_hours: number;
  results_visibility: "public" | "after_vote" | "after_close" | "staff_only";
  total_votes: number;
}

interface OptionRow extends RowDataPacket {
  id: number;
  label_en: string;
  label_ro: string;
  votes_count: number;
}

interface VoteCheckRow extends RowDataPacket {
  option_id: number;
}

export default async function PollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pollId = Number(id);
  if (!pollId || isNaN(pollId)) {
    notFound();
  }

  const [locale, session] = await Promise.all([
    getViewerLocale(),
    getCurrentSession(),
  ]);

  const poll = await dbQuerySingle<PollRow>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM panel_poll_votes WHERE poll_id = p.id) AS total_votes
     FROM panel_polls p
     WHERE p.id = ?
     LIMIT 1`,
    [pollId]
  );

  if (!poll) {
    notFound();
  }

  const options = await dbQuery<OptionRow>(
    `SELECT id, label_en, label_ro, votes_count
     FROM panel_poll_options
     WHERE poll_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [pollId]
  );

  let userVote: VoteCheckRow | null = null;
  if (session) {
    userVote = await dbQuerySingle<VoteCheckRow>(
      "SELECT option_id FROM panel_poll_votes WHERE poll_id = ? AND account_id = ? LIMIT 1",
      [pollId, session.accountId]
    );
  }

  const title = locale === "ro" ? poll.title_ro : poll.title_en;
  const desc = locale === "ro" ? poll.description_ro : poll.description_en;
  const isActive = poll.status === "active";
  const hasVoted = userVote !== null;
  const total = poll.total_votes > 0 ? poll.total_votes : 1;

  return (
    <div className="space-y-4 max-w-2xl">
      <Link
        href="/polls"
        className="inline-flex items-center space-x-1 text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors mb-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Polls</span>
      </Link>

      <div className="border border-surface-border rounded bg-surface-100 p-4 space-y-4">
        <div className="pb-3 border-b border-surface-border">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-semibold ${isActive ? "text-emerald-400" : "text-[#8F8B83]"}`}>
              {isActive ? "Active Poll" : "Closed Poll"}
            </span>
            {isActive ? (
              <PollCountdown targetDate={poll.ends_at} locale={locale} />
            ) : (
              <span className="text-[11px] text-[#8F8B83] font-mono">
                Ended {formatDate(poll.ends_at, locale)}
              </span>
            )}
          </div>
          <h1 className="text-base font-bold text-[#F2EFE8] mt-1">{title}</h1>
          {desc && (
            <p className="text-xs text-[#99958E] mt-1">{desc}</p>
          )}
        </div>

        {/* Voting Form */}
        {isActive && !hasVoted ? (
          <div className="p-3 rounded bg-surface-200 border border-surface-border">
            <PollVoteForm
              pollId={poll.id}
              options={options.map((o) => ({
                id: o.id,
                label: locale === "ro" ? o.label_ro : o.label_en,
              }))}
              userVotedOptionId={null}
              isLoggedIn={session !== null}
              minLevel={poll.minimum_level}
              minHours={poll.minimum_hours}
            />
          </div>
        ) : (
          hasVoted && (
            <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>You have voted in this poll.</span>
            </div>
          )
        )}

        {/* Results */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#8F8B83]">
            <span className="font-semibold text-[#F2EFE8]">Results</span>
            <span className="font-mono">{t(locale, "polls.total_votes", { count: poll.total_votes })}</span>
          </div>

          <div className="space-y-2">
            {options.map((opt) => {
              const label = locale === "ro" ? opt.label_ro : opt.label_en;
              const pct = Math.round((opt.votes_count / total) * 100);
              const isSelected = userVote?.option_id === opt.id;

              return (
                <div
                  key={opt.id}
                  className={`p-2.5 rounded border text-xs space-y-1 ${
                    isSelected
                      ? "bg-surface-200 border-surface-borderLight text-[#F2EFE8]"
                      : "bg-surface-100 border-surface-border text-[#B4AFA4]"
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span>
                      {label} {isSelected && <span className="text-[11px] text-emerald-400 ml-1.5">(Your Vote)</span>}
                    </span>
                    <span className="font-mono text-[#8F8B83]">
                      {opt.votes_count} ({pct}%)
                    </span>
                  </div>

                  <div className="w-full bg-surface-300 rounded h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-[#8F8B83] rounded transition-[width] duration-150"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
