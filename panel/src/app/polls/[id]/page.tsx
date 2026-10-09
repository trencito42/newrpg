import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { formatPollClosedEndLabel } from "@/lib/poll-display";
import { ArrowLeft, CheckCircle2, Crown } from "lucide-react";
import { PollCountdown } from "@/components/polls/PollCountdown";
import { PollVoteForm } from "@/components/polls/PollVoteForm";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { RowDataPacket } from "mysql2";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pollId = Number(id);
  if (!Number.isSafeInteger(pollId) || pollId < 1) notFound();
  const poll = await dbQuerySingle<PollRow>("SELECT * FROM panel_polls WHERE id = ? LIMIT 1", [pollId]);
  if (!poll) notFound();
  return buildMetadata({ title: poll.title_en, description: poll.description_en || `Vote in the RACKET RPG poll: ${poll.title_en}.`, path: `/polls/${pollId}` });
}

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
  metadata: string | Record<string, any> | null;
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
    `SELECT id, label_en, label_ro, metadata, votes_count
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
  const isMayor = title.toLowerCase().includes("primar") || title.toLowerCase().includes("mayor");

  return (
    <div className="w-full space-y-4">
      <Link
        href="/polls"
        className="inline-flex items-center space-x-1 text-xs font-bold text-[#8F8B83] hover:text-[#F2EFE8] transition-colors mb-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t(locale, "interface.back_to_polls")}</span>
      </Link>

      <div className="rounded-xl bg-[#0E0E10] p-6 space-y-6">
        <div className="pb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              {isMayor && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-800/40 uppercase tracking-wider flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  <span>{t(locale, "interface.mayoral_election_2")}</span>
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                isActive ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" : "bg-surface-200 text-[#8F8B83] border-surface-border"
              }`}>
                {isActive ? t(locale, "updateUi.voting_active") : t(locale, "updateUi.voting_closed")}
              </span>
            </div>

            {isActive ? (
              <PollCountdown targetDate={poll.ends_at} locale={locale} />
            ) : (
              <span className="text-[11px] text-[#8F8B83] font-mono">
                {formatPollClosedEndLabel(locale, poll.ends_at)}
              </span>
            )}
          </div>

          <h1 className="text-xl font-black text-[#F2EFE8] tracking-tight">{title}</h1>
          {desc && (
            <p className="text-xs text-[#8F8B83] leading-relaxed">{desc}</p>
          )}
        </div>

        {/* Voting Form */}
        {isActive && !hasVoted ? (
          <div className="p-4 rounded-xl bg-[#121214]">
            <PollVoteForm
              pollId={poll.id}
              options={options.map((o) => {
                let metaObj = null;
                if (o.metadata) {
                  try {
                    metaObj = typeof o.metadata === "string" ? JSON.parse(o.metadata) : o.metadata;
                  } catch {}
                }
                return {
                  id: o.id,
                  label: locale === "ro" ? o.label_ro : o.label_en,
                  metadata: metaObj,
                };
              })}
              userVotedOptionId={null}
              isLoggedIn={session !== null}
              minLevel={poll.minimum_level}
              minHours={poll.minimum_hours}
            />
          </div>
        ) : (
          hasVoted && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 text-emerald-400 text-xs flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{t(locale, "interface.your_vote_has_been_recorded_for_this_poll")}</span>
            </div>
          )
        )}

        {/* Results */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-[#8F8B83]">
            <span className="font-bold text-[#F2EFE8] uppercase tracking-wider text-[11px]">{t(locale, "interface.live_results")}</span>
            <span className="font-mono font-medium">{poll.total_votes} {t(locale, "interface.votes_recorded")}</span>
          </div>

          <div className="space-y-2.5">
            {options.map((opt) => {
              const label = locale === "ro" ? opt.label_ro : opt.label_en;
              const pct = Math.round((opt.votes_count / total) * 100);
              const isSelected = userVote?.option_id === opt.id;

              let candidate = null;
              if (opt.metadata) {
                try {
                  const meta = typeof opt.metadata === "string" ? JSON.parse(opt.metadata) : opt.metadata;
                  if (meta && (meta.type === "mayor_candidate" || meta.candidateUsername)) candidate = meta;
                } catch {}
              }

              return (
                <div
                  key={opt.id}
                  className={`p-4 rounded-xl text-xs space-y-2.5 transition-all ${
                    isSelected
                      ? "bg-brand/15 text-[#F2EFE8]"
                      : "bg-[#121214] text-[#B4AFA4]"
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <div className="flex items-center space-x-3 min-w-0">
                      {candidate && (
                        <div className="w-8 h-8 rounded-lg bg-[#18181b] overflow-hidden shrink-0 flex items-center justify-center">
                          <GTAImage
                            src={getPedAvatarUrl(candidate.candidateSkin)}
                            alt={candidate.candidateName || label}
                            fallbackText={(candidate.candidateName || label).charAt(0).toUpperCase()}
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          {candidate && <Crown className="w-3.5 h-3.5 text-brand shrink-0" />}
                          <span className="font-bold text-[#F2EFE8] truncate">
                            {candidate?.candidateName ? `${candidate.candidateName} (${candidate.candidateUsername})` : label}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] text-emerald-400 font-bold ml-1.5 px-1.5 py-0.5 bg-emerald-950/60 rounded border border-emerald-800/40">
                              {t(locale, "interface.your_vote")}</span>
                          )}
                        </div>
                        {candidate?.slogan && (
                          <span className="text-[11px] text-[#8F8B83] block truncate italic">
                            „{candidate.slogan}”
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="font-mono font-bold text-[#F2EFE8] shrink-0 ml-2">
                      {opt.votes_count} <span className="text-[#8F8B83] font-normal">({pct}%)</span>
                    </span>
                  </div>

                  <div className="w-full bg-[#191719] rounded-full h-2 overflow-hidden border border-surface-border/40">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSelected ? "bg-brand" : "bg-gradient-to-r from-brand/60 to-brand"
                      }`}
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
