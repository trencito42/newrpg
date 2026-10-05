"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import type { CommunityActivityEntry, CharacterCommunityCounts } from "@/lib/community-activity";
import type { FeedPost } from "@/lib/social-feed";
import { SocialPostCard } from "@/components/social/SocialPostCard";
import { socialRelativeTime } from "@/components/social/social-time";

type Filter = "all" | "feed" | "forum";

export function PlayerCommunityActivity({
  locale,
  entries,
  feedPosts,
  counts,
  isLoggedIn,
  viewerCharId,
}: {
  locale: Locale;
  entries: CommunityActivityEntry[];
  feedPosts: FeedPost[];
  counts: CharacterCommunityCounts;
  isLoggedIn: boolean;
  viewerCharId: number | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "forum") return entries.filter((e) => e.type !== "social_post");
    if (filter === "feed") return [];
    return entries;
  }, [entries, filter]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: t(locale, "community.filter_all") },
    { id: "feed", label: t(locale, "nav.feed") },
    { id: "forum", label: t(locale, "nav.forum") },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
            {t(locale, "community.activity_title")}
          </h2>
          <p className="text-[11px] text-[#8F8B83] mt-1">
            {counts.feedPosts} {t(locale, "community.feed_posts")} · {counts.forumPosts}{" "}
            {t(locale, "community.forum_posts")} · {counts.forumTopics} {t(locale, "community.topics")}
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-[rgba(255,255,255,0.04)] w-full sm:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex-1 sm:flex-none px-3 min-h-[44px] text-xs font-semibold rounded-md transition-colors ${
                filter === tab.id ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-[#0E0E10] p-4">
        {filter === "feed" ? (
          feedPosts.length === 0 ? (
            <p className="text-sm text-[#8F8B83] text-center py-8">{t(locale, "community.no_activity")}</p>
          ) : (
            feedPosts.map((p) => (
              <SocialPostCard
                key={p.id}
                post={p}
                locale={locale}
                isLoggedIn={isLoggedIn}
                viewerCharId={viewerCharId}
                variant="profile"
              />
            ))
          )
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#8F8B83] text-center py-8">{t(locale, "community.no_activity")}</p>
        ) : (
          <div className="space-y-0">
            {filtered.map((entry) => {
              if (entry.type === "social_post" && entry.socialPost) {
                const p = entry.socialPost;
                return (
                  <Link
                    key={`s-${entry.id}`}
                    href={entry.href}
                    className="block py-3 border-b border-[rgba(255,255,255,0.06)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] -mx-2 px-2 rounded-lg"
                  >
                    <p className="text-[10px] uppercase text-[#D7B558] font-semibold mb-1">
                      {t(locale, "community.feed_post")}
                    </p>
                    {p.body && <p className="text-sm text-[#D4CFC8] line-clamp-2">{p.body}</p>}
                    {p.thumbnail_url && (
                      <img
                        src={p.thumbnail_url}
                        alt=""
                        className="mt-2 h-16 w-auto rounded object-cover"
                      />
                    )}
                    <p className="text-[11px] text-[#8F8B83] mt-2">
                      {t(locale, "community.likes_and_comments", {
                        likes: String(Number(p.likes_count)),
                        comments: String(Number(p.comments_count)),
                      })}{" "}
                      · {socialRelativeTime(p.created_at)}
                    </p>
                  </Link>
                );
              }

              return (
                <Link
                  key={`f-${entry.id}`}
                  href={entry.href}
                  className="block py-3 border-b border-[rgba(255,255,255,0.06)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] -mx-2 px-2 rounded-lg"
                >
                  <p className="text-[10px] uppercase text-[#D7B558] font-semibold mb-1">
                    {entry.type === "forum_topic"
                      ? t(locale, "community.started_topic")
                      : t(locale, "community.replied")}
                    {entry.forumName ? ` · ${entry.forumName}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-[#F2EFE8] line-clamp-2">{entry.forumTopicTitle}</p>
                  {entry.forumExcerpt && (
                    <p className="text-xs text-[#99958E] mt-1 line-clamp-2">{entry.forumExcerpt}</p>
                  )}
                  <p className="text-[11px] text-[#8F8B83] mt-2">{socialRelativeTime(entry.createdAt)}</p>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
