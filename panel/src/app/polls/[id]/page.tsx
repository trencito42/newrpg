import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ArrowLeft, Vote, Clock, CheckCircle2, ShieldCheck } from "lucide-react";
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

  // Check if current user already voted
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        href="/polls"
        className="inline-flex items-center space-x-1.5 text-xs text-gray-400 hover:text-brand transition-colors mb-2"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to All Polls</span>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant={isActive ? "brand" : "default"}>
              {poll.status.toUpperCase()}
            </Badge>
            {isActive ? (
              <PollCountdown targetDate={poll.ends_at} locale={locale} />
            ) : (
              <span className="text-xs text-gray-500 font-mono">
                Concluded: {formatDate(poll.ends_at, locale)}
              </span>
            )}
          </div>
          <CardTitle className="text-xl mt-2">{title}</CardTitle>
          {desc && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{desc}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Voting form (if active and not yet voted) */}
          {isActive && !hasVoted ? (
            <div className="p-4 rounded-xl bg-surface-100 border border-surface-border">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                <Vote className="w-3.5 h-3.5 text-brand" />
                <span>Cast Your Official Vote</span>
              </h4>
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
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>You have already cast your vote in this poll.</span>
              </div>
            )
          )}

          {/* Results Overview */}
          <div>
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Current Results</span>
              <span className="text-gray-500 font-mono">
                {t(locale, "polls.total_votes", { count: poll.total_votes })}
              </span>
            </h4>

            <div className="space-y-3">
              {options.map((opt) => {
                const label = locale === "ro" ? opt.label_ro : opt.label_en;
                const pct = Math.round((opt.votes_count / total) * 100);
                const isSelected = userVote?.option_id === opt.id;

                return (
                  <div
                    key={opt.id}
                    className={`p-3 rounded-xl border space-y-1.5 ${
                      isSelected
                        ? "bg-brand/5 border-brand/50 text-white"
                        : "bg-surface-100 border-surface-border text-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center space-x-1.5">
                        <span>{label}</span>
                        {isSelected && (
                          <Badge variant="brand" className="text-[10px] px-1 py-0">
                            Your Vote
                          </Badge>
                        )}
                      </span>
                      <span className="font-mono text-gray-400">
                        {opt.votes_count} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-surface-200 rounded-full h-2 border border-surface-border overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSelected ? "bg-brand" : "bg-gray-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verification & Eligibility notice */}
          <div className="p-3 bg-surface-50 rounded-lg border border-surface-border text-xs text-gray-500 flex items-start space-x-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div>
              <span>Voting integrity: One-account-one-vote enforced by database unique key.</span>
              <span className="block mt-0.5 text-gray-600">
                Minimum level: {poll.minimum_level} • Minimum hours: {poll.minimum_hours}h
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
