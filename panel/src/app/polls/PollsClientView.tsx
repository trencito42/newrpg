"use client";

import { useState } from "react";
import Link from "next/link";
import { Vote, Plus, Crown, Calendar, Sparkles, CheckCircle2 } from "lucide-react";
import { PollCountdown } from "@/components/polls/PollCountdown";
import { CreatePollModal } from "@/components/polls/CreatePollModal";
import { t } from "@/lib/i18n";
import { formatPollClosedEndLabel } from "@/lib/poll-display";

export interface PollItem {
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

interface PollsClientViewProps {
  polls: PollItem[];
  canCreate: boolean;
  locale: "en" | "ro";
}

export function PollsClientView({ polls, canCreate, locale }: PollsClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E0E10] p-4 sm:p-5 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded-lg bg-[#D7B558]/10 text-[#D7B558]">
              <Vote className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#F2EFE8]">
              {t(locale, "copy.app_polls_pollsclientview.community_polls_elections")}
            </h1>
          </div>
          <p className="text-xs text-[#8F8B83]">
            {t(locale, "copy.app_polls_pollsclientview.vote_on_official_server_decisions_and_choose_the_next_mayor_of_los_santos")}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold text-xs rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t(locale, "copy.app_polls_pollsclientview.create_poll_election")}</span>
          </button>
        )}
      </div>

      {/* Grid of Polls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {polls.map((p) => {
          const title = locale === "ro" ? p.title_ro : p.title_en;
          const desc = locale === "ro" ? p.description_ro : p.description_en;
          const isActive = p.status === "active";
          const isMayor = title.toLowerCase().includes("primar") || title.toLowerCase().includes("mayor");

          return (
            <Link
              key={p.id}
              href={`/polls/${p.id}`}
              className="p-5 bg-[#0E0E10] hover:bg-[#141418] rounded-xl transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    {isMayor && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        <span>{t(locale, "interface.mayoral_election_2")}</span>
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.04] text-[#8F8B83]"
                    }`}>
                      {isActive ? (t(locale, "common.active")) : (t(locale, "copy.app_polls_pollsclientview.closed"))}
                    </span>
                  </div>

                  {isActive ? (
                    <PollCountdown targetDate={p.ends_at} locale={locale} />
                  ) : (
                    <span className="text-[11px] text-[#8F8B83] font-mono">
                      {formatPollClosedEndLabel(locale, p.ends_at)}
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-base font-bold text-[#F2EFE8] transition-colors line-clamp-2">
                    {title}
                  </h2>
                  {desc && (
                    <p className="text-xs text-[#8F8B83] mt-1.5 line-clamp-2 leading-relaxed">
                      {desc}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs text-[#8F8B83]">
                <span className="font-mono font-medium">
                  {p.total_votes} {t(locale, "copy.app_polls_pollsclientview.total_votes")}
                </span>

                {p.user_voted ? (
                  <span className="flex items-center space-x-1 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t(locale, "copy.app_polls_pollsclientview.voted")}</span>
                  </span>
                ) : isActive ? (
                  <span className="text-[#D7B558] font-semibold text-[11px]">
                    {t(locale, "copy.app_polls_pollsclientview.vote_now")}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}

        {polls.length === 0 && (
          <div className="col-span-2 text-center py-16 bg-[#0E0E10] rounded-xl space-y-2">
            <Vote className="w-8 h-8 text-[#5A5751] mx-auto" />
            <p className="text-sm font-semibold text-[#8F8B83]">
              {t(locale, "copy.app_polls_pollsclientview.no_active_polls_at_the_moment")}
            </p>
          </div>
        )}
      </div>

      {canCreate && (
        <CreatePollModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          locale={locale}
        />
      )}
    </div>
  );
}
