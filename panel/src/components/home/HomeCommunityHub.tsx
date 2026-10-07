"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import type { HomeForumActivityItem } from "@/lib/home-forum-activity";
import { SocialFeedList } from "@/components/social/SocialFeedList";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { socialRelativeTime } from "@/components/social/social-time";

type MobileTab = "feed" | "forum";

function ForumDiscussionRows({
  locale,
  forumItems,
}: {
  locale: Locale;
  forumItems: HomeForumActivityItem[];
}) {
  if (forumItems.length === 0) {
    return (
      <p className="text-sm text-[#8F8B83] py-6 text-center">{t(locale, "community.no_forum_activity")}</p>
    );
  }

  return (
    <ul className="divide-y divide-[rgba(255,255,255,0.06)]">
      {forumItems.map((item) => (
        <li key={item.postId}>
          <Link
            href={item.href}
            className="flex flex-col gap-1 py-3 hover:bg-[rgba(255,255,255,0.02)] -mx-2 px-2 rounded-lg transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-medium text-[#D7B558] truncate">{item.forumName}</span>
              {item.replyCount > 0 ? (
                <span className="text-[11px] text-[#8F8B83] shrink-0 font-mono">
                  {item.replyCount} {t(locale, "community.replies")}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-semibold text-[#F2EFE8] line-clamp-2 leading-snug group-hover:text-[#D7B558] transition-colors">
              {item.topicTitle}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8F8B83]">
              {item.authorIdentity ? (
                <PlayerIdentity
                  username={item.authorIdentity.username}
                  factionId={item.authorIdentity.factionId}
                  factionColor={item.authorIdentity.factionColor}
                  clanTag={item.authorIdentity.clanTag}
                  clanColor={item.authorIdentity.clanColor}
                  clanTagStyle={item.authorIdentity.clanTagStyle}
                  size="sm"
                />
              ) : (
                <span>{item.authorUsername}</span>
              )}
              <span aria-hidden>·</span>
              <span>{socialRelativeTime(item.createdAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FeedPanel({
  locale,
  posts,
  viewerCharId,
  isLoggedIn,
}: {
  locale: Locale;
  posts: FeedPost[];
  viewerCharId: number | null;
  isLoggedIn: boolean;
}) {
  const [localPosts, setLocalPosts] = useState(posts);

  return (
    <div className="min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#F2EFE8]">{t(locale, "community.latest_activity")}</h3>
        <Link
          href="/feed"
          className="text-xs text-[#D7B558] hover:text-[#E3C572] font-medium flex items-center gap-0.5 transition-colors"
        >
          {t(locale, "community.view_all_feed")}
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>

      {isLoggedIn ? (
        <Link
          href="/feed"
          className="mb-3 block text-xs text-[#8F8B83] hover:text-[#D7B558] transition-colors py-1"
        >
          {t(locale, "home.whats_happening")}
        </Link>
      ) : null}

      <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0A0A0C]/40 px-3 sm:px-4">
        <SocialFeedList
          locale={locale}
          posts={localPosts}
          viewerCharId={viewerCharId}
          isLoggedIn={isLoggedIn}
          variant="profile"
          showLoadMore={false}
          onPostsChange={setLocalPosts}
        />
      </div>
    </div>
  );
}

function ForumPanel({ locale, forumItems }: { locale: Locale; forumItems: HomeForumActivityItem[] }) {
  return (
    <div className="min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#F2EFE8] flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#8F8B83]" aria-hidden />
          {t(locale, "community.latest_forum_discussions")}
        </h3>
        <Link
          href="/forum"
          className="text-xs text-[#D7B558] hover:text-[#E3C572] font-medium flex items-center gap-0.5 transition-colors"
        >
          {t(locale, "community.view_all_forum")}
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>
      <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0A0A0C]/40 px-3 sm:px-4">
        <ForumDiscussionRows locale={locale} forumItems={forumItems} />
      </div>
    </div>
  );
}

export function HomeCommunityHub({
  locale,
  feedPosts,
  forumItems,
  isLoggedIn,
  viewerCharId,
}: {
  locale: Locale;
  feedPosts: FeedPost[];
  forumItems: HomeForumActivityItem[];
  isLoggedIn: boolean;
  viewerCharId: number | null;
}) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("feed");

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-[#8F8B83] tracking-wide uppercase">
        {t(locale, "community.section_title")}
      </h2>

      <div className="flex gap-1 p-1 rounded-lg bg-[rgba(255,255,255,0.04)] md:hidden">
        {(["feed", "forum"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`flex-1 min-h-[44px] text-xs font-semibold rounded-md transition-colors ${
              mobileTab === id ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83]"
            }`}
          >
            {id === "feed" ? t(locale, "community.latest_activity") : t(locale, "nav.forum")}
          </button>
        ))}
      </div>

      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(260px,34%)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,32%)] gap-8 lg:gap-10">
        <FeedPanel
          locale={locale}
          posts={feedPosts}
          viewerCharId={viewerCharId}
          isLoggedIn={isLoggedIn}
        />
        <ForumPanel locale={locale} forumItems={forumItems} />
      </div>

      <div className="md:hidden space-y-6">
        {mobileTab === "feed" ? (
          <FeedPanel
            locale={locale}
            posts={feedPosts}
            viewerCharId={viewerCharId}
            isLoggedIn={isLoggedIn}
          />
        ) : (
          <ForumPanel locale={locale} forumItems={forumItems} />
        )}
      </div>
    </section>
  );
}
