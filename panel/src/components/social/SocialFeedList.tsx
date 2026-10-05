"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import { SocialPostCard, type SocialPostVariant } from "./SocialPostCard";

export function SocialFeedList({
  locale,
  posts,
  viewerCharId,
  isLoggedIn,
  variant = "full",
  nextCursor,
  feedTab = "global",
  onPostsChange,
  showLoadMore = true,
}: {
  locale: Locale;
  posts: FeedPost[];
  viewerCharId: number | null;
  isLoggedIn: boolean;
  variant?: SocialPostVariant;
  nextCursor?: number | null;
  feedTab?: "contacts" | "global";
  onPostsChange?: (posts: FeedPost[]) => void;
  showLoadMore?: boolean;
}) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(nextCursor ?? null);
  const [localPosts, setLocalPosts] = useState(posts);

  const handleDeleted = (id: number) => {
    setLocalPosts((p) => p.filter((x) => x.id !== id));
    onPostsChange?.(localPosts.filter((x) => x.id !== id));
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = `/api/feed/posts?feed=${feedTab}&before_id=${cursor}&limit=20`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const newPosts: FeedPost[] = data.posts || [];
        const next = data.nextCursor;
        setLocalPosts((p) => {
          const merged = [...p, ...newPosts];
          onPostsChange?.(merged);
          return merged;
        });
        setCursor(next);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const list = onPostsChange ? localPosts : posts;

  if (list.length === 0) {
    return (
      <p className="text-sm text-[#8F8B83] text-center py-8">
        {t(locale, "feed.no_posts_global")}
      </p>
    );
  }

  return (
    <>
      {list.map((p) => (
        <SocialPostCard
          key={p.id}
          post={p}
          viewerCharId={viewerCharId}
          isLoggedIn={isLoggedIn}
          locale={locale}
          variant={variant}
          onDeleted={handleDeleted}
        />
      ))}

      {showLoadMore && cursor && (
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-1.5 mx-auto text-xs text-[#8F8B83] hover:text-[#D4CFC8] disabled:opacity-40 transition-colors min-h-[44px] px-4"
          >
            <ChevronDown size={14} />
            {loadingMore ? t(locale, "feed.loading") : t(locale, "feed.load_more")}
          </button>
        </div>
      )}
    </>
  );
}
