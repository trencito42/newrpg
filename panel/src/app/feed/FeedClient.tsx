"use client";

import { useState } from "react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import { SocialComposer } from "@/components/social/SocialComposer";
import { SocialFeedList } from "@/components/social/SocialFeedList";

interface FeedClientProps {
  locale: Locale;
  initialGlobal: FeedPost[];
  initialContacts: FeedPost[];
  nextGlobalCursor: number | null;
  nextContactsCursor: number | null;
  isLoggedIn: boolean;
  viewerCharId: number | null;
  viewerCharName: string | null;
}

export function FeedClient({
  locale,
  initialGlobal,
  initialContacts,
  nextGlobalCursor,
  nextContactsCursor,
  isLoggedIn,
  viewerCharId,
}: FeedClientProps) {
  const defaultTab = initialContacts.length > 0 ? "contacts" : "global";
  const [tab, setTab] = useState<"contacts" | "global">(defaultTab);
  const [globalPosts, setGlobalPosts] = useState(initialGlobal);
  const [contactsPosts, setContactsPosts] = useState(initialContacts);

  const posts = tab === "contacts" ? contactsPosts : globalPosts;
  const cursor = tab === "contacts" ? nextContactsCursor : nextGlobalCursor;

  const setPosts = (next: FeedPost[]) => {
    if (tab === "global") setGlobalPosts(next);
    else setContactsPosts(next);
  };

  return (
    <div>
      <div className="flex gap-1 mb-5 bg-[rgba(255,255,255,0.04)] rounded-lg p-1 w-fit">
        {(["contacts", "global"] as const).map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors min-h-[40px] ${tab === tabId ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83] hover:text-[#D4CFC8]"}`}
          >
            {tabId === "contacts" ? t(locale, "feed.tab_contacts") : t(locale, "feed.tab_global")}
          </button>
        ))}
      </div>

      {isLoggedIn && <SocialComposer locale={locale} variant="full" />}

      {posts.length === 0 ? (
        <p className="text-sm text-[#8F8B83] text-center py-12">
          {tab === "contacts" ? t(locale, "feed.no_posts_contacts") : t(locale, "feed.no_posts_global")}
        </p>
      ) : (
        <SocialFeedList
          locale={locale}
          posts={posts}
          viewerCharId={viewerCharId}
          isLoggedIn={isLoggedIn}
          variant="full"
          nextCursor={cursor}
          feedTab={tab}
          onPostsChange={setPosts}
        />
      )}
    </div>
  );
}
