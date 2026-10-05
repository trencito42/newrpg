"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import { SocialPedAvatar } from "./SocialPedAvatar";
import { socialRelativeTime } from "./social-time";

interface CommentRow {
  id: number;
  parent_comment_id?: number | null;
  firstname?: string;
  lastname?: string;
  body: string;
  created_at: string;
}

export function SocialComments({
  postId,
  locale,
  isLoggedIn,
  commentCount,
  onCommentCountChange,
  defaultExpanded = false,
  compact = false,
}: {
  postId: number;
  locale: Locale;
  isLoggedIn: boolean;
  commentCount: number;
  onCommentCountChange: (n: number) => void;
  defaultExpanded?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const loadComments = async () => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/feed/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && comments.length === 0) loadComments();
  };

  const sendComment = async () => {
    if (!commentText.trim() || !isLoggedIn) return;
    const body = commentText.trim();
    setCommentText("");
    try {
      const res = await fetch(`/api/feed/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) setComments((prev) => [...prev, data.comment]);
        onCommentCountChange(data.commentsCount ?? commentCount + 1);
      }
    } catch {
      /* ignore */
    }
  };

  if (!expanded && compact) {
    return (
      <button
        type="button"
        onClick={toggleComments}
        className="text-xs text-[#8F8B83] hover:text-[#D4CFC8] min-h-[40px] px-1"
      >
        {commentCount} {t(locale, "community.comments_label")}
      </button>
    );
  }

  return (
    <>
      {!defaultExpanded && (
        <button
          type="button"
          onClick={toggleComments}
          className="text-xs text-[#8F8B83] hover:text-[#D4CFC8] transition-colors min-h-[40px]"
        >
          {commentCount}
        </button>
      )}
      {expanded && (
        <div className="mt-4 pl-3 border-l border-[rgba(255,255,255,0.07)]">
          {loadingComments && (
            <p className="text-xs text-[#8F8B83]">{t(locale, "feed.loading_comments")}</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className={`flex gap-2 mb-3 ${c.parent_comment_id ? "ml-6" : ""}`}>
              <SocialPedAvatar
                skin={null}
                name={`${c.firstname ?? "?"}${c.lastname ?? ""}`}
                size="sm"
              />
              <div className="flex-1">
                <span className="text-xs font-semibold text-[#D4CFC8]">
                  {c.firstname} {c.lastname}
                </span>
                <span className="text-[10px] text-[#8F8B83] ml-1">{socialRelativeTime(c.created_at)}</span>
                <p className="text-xs text-[#B4AFA4] mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </div>
          ))}

          {isLoggedIn && (
            <div className="flex gap-2 mt-3">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendComment())
                }
                placeholder={t(locale, "feed.add_comment_placeholder")}
                maxLength={400}
                className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-full px-3 py-2.5 text-xs text-[#F2EFE8] placeholder-[#8F8B83] outline-none focus:border-[rgba(215,181,88,0.4)] min-h-[40px]"
              />
              <button
                type="button"
                onClick={sendComment}
                className="text-[#d7b558] hover:text-[#e9ca6f] transition-colors p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
