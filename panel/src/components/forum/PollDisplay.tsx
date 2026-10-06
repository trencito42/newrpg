"use client";
import { t, type Locale } from "@/lib/i18n";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ForumPoll } from "@/lib/forum-types";
import { CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PollDisplayProps {
  poll: ForumPoll;
  topicId: number;
  locale: "en" | "ro";
}

export function PollDisplay({ poll, topicId, locale }: PollDisplayProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(poll.user_vote_option_ids ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState((poll.user_vote_option_ids?.length ?? 0) > 0);
  const router = useRouter();

  const totalVotes = poll.total_votes ?? poll.options.reduce((s, o) => s + o.votes_count, 0);
  const isClosed = poll.closes_at ? new Date(poll.closes_at) < new Date() : false;
  const canVote = !isClosed && (!hasVoted || poll.allows_change);

  const toggleOption = (optId: number) => {
    if (!canVote) return;
    if (poll.max_selections === 1) {
      setSelectedIds([optId]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(optId)
          ? prev.filter((id) => id !== optId)
          : prev.length < poll.max_selections
          ? [...prev, optId]
          : prev
      );
    }
  };

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/forum/polls/${topicId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setHasVoted(true);
        router.refresh();
      } else {
        const code = String(data.error || "");
        const msg =
          code === "already_voted"
            ? t(locale, "polls.already_voted")
            : code === "poll_closed"
              ? t(locale, "forumUi.poll_closed")
              : t(locale, "forumUi.error_generic");
        setError(msg);
      }
    } catch {
      setError(t(locale, "forumUi.error_network"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-foreground">{poll.question}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span>{totalVotes} {t(locale, "forumUi.votes")}</span>
          {isClosed && (
            <span className="text-yellow-400">{t(locale, "forumUi.poll_closed")}</span>
          )}
          {poll.closes_at && !isClosed && (
            <span>
              · {t(locale, "forumUi.closes")}{" "}
              {new Date(poll.closes_at).toLocaleDateString("en-US")}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleVote} className="space-y-2">
        {poll.options.map((option) => {
          const percentage = totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0;
          const isSelected = selectedIds.includes(option.id);

          return (
            <div key={option.id} className="relative">
              {/* Vote bar background */}
              {(hasVoted || isClosed) && (
                <div
                  className="absolute inset-y-0 left-0 bg-brand/20 rounded-lg transition-all"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <button
                type="button"
                onClick={() => toggleOption(option.id)}
                disabled={!canVote}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                  canVote ? "hover:bg-surface-200 cursor-pointer" : "cursor-default"
                } ${isSelected ? "border border-brand" : "border border-transparent"}`}
              >
                {canVote && (
                  isSelected
                    ? <CheckSquare className="w-4 h-4 text-brand flex-shrink-0" />
                    : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="flex-1 text-foreground">{option.label}</span>
                {(hasVoted || isClosed) && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{option.votes_count}</span>
                    <span className="text-xs font-bold text-foreground w-8 text-right">{percentage}%</span>
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {canVote && (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={selectedIds.length === 0}
            className="mt-2"
          >
            {hasVoted
              ? ("Change Vote")
              : ("Vote")}
          </Button>
        )}
      </form>
    </div>
  );
}
