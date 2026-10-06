"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { LikersTooltip } from "@/components/ui/LikersTooltip";
import { useViewerLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface ArticleReactionsProps {
  slug: string;
  initialLikes: number;
  initialDislikes: number;
  initialMyReaction: string | null;
  isLoggedIn: boolean;
}

export function ArticleReactions({
  slug,
  initialLikes,
  initialDislikes,
  initialMyReaction,
  isLoggedIn,
}: ArticleReactionsProps) {
  const locale = useViewerLocale();
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [myReaction, setMyReaction] = useState<string | null>(initialMyReaction);
  const [loading, setLoading] = useState(false);

  const loginHint = t(locale, "updateUi.log_in_to_react");

  const react = async (reaction: "like" | "dislike") => {
    if (loading || !isLoggedIn) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/updates/${slug}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (res.ok) {
        const data = await res.json();
        setLikes(data.likes_count);
        setDislikes(data.dislikes_count);
        setMyReaction(data.my_reaction);
      }
    } finally {
      setLoading(false);
    }
  };

  const total = likes + dislikes;
  const likeRatio = total > 0 ? Math.round((likes / total) * 100) : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <LikersTooltip count={likes} fetchUrl={`/api/updates/${slug}/likers`} disabled={!isLoggedIn}>
        <button
          type="button"
          onClick={() => react("like")}
          disabled={loading || !isLoggedIn}
          title={isLoggedIn ? undefined : loginHint}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            myReaction === "like"
              ? "bg-emerald-950/70 text-emerald-400 border border-emerald-700/60"
              : "bg-[#141417] text-[#8F8B83] hover:text-emerald-400 border border-surface-border hover:border-emerald-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
          <span>{likes}</span>
        </button>
      </LikersTooltip>

      <button
        type="button"
        onClick={() => react("dislike")}
        disabled={loading || !isLoggedIn}
        title={isLoggedIn ? undefined : loginHint}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
          myReaction === "dislike"
            ? "bg-red-950/70 text-red-400 border border-red-700/60"
            : "bg-[#141417] text-[#8F8B83] hover:text-red-400 border border-surface-border hover:border-red-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        <ThumbsDown className="w-4 h-4" />
        <span>{dislikes}</span>
      </button>

      {likeRatio !== null && (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-[#1A1A1E] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${likeRatio}%` }}
            />
          </div>
          <span className="text-xs text-[#8F8B83] font-mono">{likeRatio}%</span>
        </div>
      )}

      {!isLoggedIn && (
        <span className="text-xs text-[#5A5751]">{loginHint}</span>
      )}
    </div>
  );
}
