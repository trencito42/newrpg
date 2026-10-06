"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Vote, CheckCircle2, AlertCircle, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { useViewerLocale } from "@/components/LocaleProvider";
import { t, translateApiError } from "@/lib/i18n";

export interface PollOptionItem {
  id: number;
  label: string;
  metadata?: {
    type?: string;
    candidateUsername?: string;
    candidateName?: string;
    candidateSkin?: string;
    slogan?: string;
  } | null;
}

export function PollVoteForm({
  pollId,
  options,
  userVotedOptionId,
  isLoggedIn,
  minLevel,
  minHours,
}: {
  pollId: number;
  options: PollOptionItem[];
  userVotedOptionId: number | null;
  isLoggedIn: boolean;
  minLevel: number;
  minHours: number;
}) {
  const locale = useViewerLocale();
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<number | null>(
    userVotedOptionId
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(userVotedOptionId !== null);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption || success) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, optionId: selectedOption }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(translateApiError(locale, String(data.error || "")) || t(locale, "pollUi.vote_failed"));
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError(t(locale, "pollUi.network_error"));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="p-4 rounded-xl bg-surface-100 border border-surface-border text-center text-xs text-[#8F8B83] space-y-2">
        <p>{t(locale, "interface.log_in_to_vote_in_this_poll")}</p>
        <a
          href="/login"
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand text-[#08080A] font-extrabold uppercase rounded-lg text-xs transition-colors hover:bg-brand-300"
        >
          <Vote className="w-3.5 h-3.5" />
          <span>{t(locale, "forumUi.log_in")}</span>
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs flex items-center space-x-2.5">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span className="font-semibold">{t(locale, "pollUi.vote_recorded")}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleVote} className="space-y-3.5">
      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selectedOption === opt.id;
          const candidate = opt.metadata?.type === "mayor_candidate" || opt.metadata?.candidateUsername ? opt.metadata : null;

          return (
            <label
              key={opt.id}
              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                isSelected
                  ? "bg-brand/10 border-brand text-[#F2EFE8] shadow-md shadow-brand/5 ring-1 ring-brand"
                  : "bg-surface-100 border-surface-border text-[#B4AFA4] hover:bg-surface-200/70 hover:border-surface-borderLight"
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <input
                  type="radio"
                  name="poll_option"
                  value={opt.id}
                  checked={isSelected}
                  onChange={() => setSelectedOption(opt.id)}
                  className="text-brand focus:ring-brand h-4 w-4 bg-surface-200 border-surface-border shrink-0"
                />

                {candidate && (
                  <div className="w-10 h-10 rounded-lg bg-surface-200 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                    <GTAImage
                      src={getPedAvatarUrl(candidate.candidateSkin)}
                      alt={candidate.candidateName || opt.label}
                      fallbackText={(candidate.candidateName || opt.label).charAt(0).toUpperCase()}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    {candidate && <Crown className="w-3.5 h-3.5 text-brand shrink-0" />}
                    <span className="font-bold text-[#F2EFE8] block truncate">
                      {candidate?.candidateName ? `${candidate.candidateName} (${candidate.candidateUsername})` : opt.label}
                    </span>
                  </div>
                  {candidate?.slogan && (
                    <span className="text-[11px] text-[#8F8B83] block truncate italic mt-0.5">
                      „{candidate.slogan}”
                    </span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-border">
        <span className="text-[11px] text-[#8F8B83] font-mono">
          {t(locale, "pollUi.requirements", { level: minLevel, hours: minHours })}
        </span>
        <button
          type="submit"
          disabled={!selectedOption || loading}
          className="flex items-center space-x-1.5 px-5 py-2 bg-brand hover:bg-brand-300 disabled:opacity-50 text-[#08080A] font-extrabold uppercase rounded-lg text-xs transition-all shadow-md"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Vote className="w-3.5 h-3.5" />
          )}
          <span>{loading ? t(locale, "pollUi.submitting") : t(locale, "pollUi.submit_vote")}</span>
        </button>
      </div>
    </form>
  );
}
