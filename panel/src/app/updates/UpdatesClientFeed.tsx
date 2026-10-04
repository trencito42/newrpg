"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Search,
  Pin,
  Calendar,
  Eye,
  User,
  Plus,
  ArrowRight,
  Newspaper,
  Tag,
  Clock,
  Flame,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { PostUpdateModal } from "./PostUpdateModal";
import { t, formatDate } from "@/lib/i18n";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { LikersTooltip } from "@/components/ui/LikersTooltip";

export interface UpdateItem {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  cover_image: string | null;
  author_account_id: number;
  author_name: string;
  author_skin?: string | null;
  is_pinned: number;
  views_count: number;
  likes_count: number;
  dislikes_count: number;
  my_reaction?: string | null;
  created_at: string;
}

interface UpdatesClientFeedProps {
  initialUpdates: UpdateItem[];
  canPost: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
  locale: "en" | "ro";
}

interface ReactionState {
  likes_count: number;
  dislikes_count: number;
  my_reaction: string | null;
}

function ReactionBar({ item, isLoggedIn, slug }: { item: UpdateItem; isLoggedIn: boolean; slug?: string }) {
  const resolvedSlug = slug ?? item.slug;
  const [rx, setRx] = useState<ReactionState>({
    likes_count: item.likes_count ?? 0,
    dislikes_count: item.dislikes_count ?? 0,
    my_reaction: item.my_reaction ?? null,
  });
  const [loading, setLoading] = useState(false);

  const react = async (reaction: "like" | "dislike") => {
    if (loading || !isLoggedIn) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/updates/${item.slug}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (res.ok) {
        const data = await res.json();
        setRx({ likes_count: data.likes_count, dislikes_count: data.dislikes_count, my_reaction: data.my_reaction });
      }
    } finally {
      setLoading(false);
    }
  };

  const total = rx.likes_count + rx.dislikes_count;
  const likeRatio = total > 0 ? Math.round((rx.likes_count / total) * 100) : null;

  return (
    <div className="flex items-center gap-2">
      <LikersTooltip count={rx.likes_count} fetchUrl={`/api/updates/${resolvedSlug}/likers`} disabled={!isLoggedIn}>
        <button
          onClick={() => react("like")}
          disabled={loading || !isLoggedIn}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            rx.my_reaction === "like"
              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
              : "bg-[#141417] text-[#8F8B83] hover:text-emerald-400 border border-transparent hover:border-emerald-800/40 disabled:opacity-40"
          }`}
          title={isLoggedIn ? undefined : "Log in to react"}
        >
          <ThumbsUp className="w-3 h-3" />
          <span>{rx.likes_count}</span>
        </button>
      </LikersTooltip>
      <button
        onClick={() => react("dislike")}
        disabled={loading || !isLoggedIn}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
          rx.my_reaction === "dislike"
            ? "bg-red-950/60 text-red-400 border border-red-800/40"
            : "bg-[#141417] text-[#8F8B83] hover:text-red-400 border border-transparent hover:border-red-800/40 disabled:opacity-40"
        }`}
        title={isLoggedIn ? undefined : "Log in to react"}
      >
        <ThumbsDown className="w-3 h-3" />
        <span>{rx.dislikes_count}</span>
      </button>
      {likeRatio !== null && (
        <span className="text-[10px] text-[#8F8B83] font-mono">{likeRatio}% positive</span>
      )}
    </div>
  );
}

const CATEGORY_TABS = [
  { id: "all", label: "Toate" },
  { id: "update", label: "Updates" },
  { id: "patch-notes", label: "Patch Notes" },
  { id: "anunt", label: "Anunțuri" },
  { id: "eveniment", label: "Evenimente" },
  { id: "ghid", label: "Ghiduri" },
];

function getCategoryBadge(category: string) {
  switch (category.toLowerCase()) {
    case "patch-notes":
      return { label: "Patch Notes", bg: "bg-blue-950/60 text-blue-400 border-blue-800/40" };
    case "anunt":
      return { label: "Anunț", bg: "bg-amber-950/60 text-amber-400 border-amber-800/40" };
    case "eveniment":
      return { label: "Eveniment", bg: "bg-purple-950/60 text-purple-400 border-purple-800/40" };
    case "ghid":
      return { label: "Ghid", bg: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" };
    case "update":
    default:
      return { label: "Update", bg: "bg-[#D7B558]/10 text-[#D7B558] border-[#D7B558]/30" };
  }
}

export function UpdatesClientFeed({
  initialUpdates,
  canPost,
  isAdmin,
  isLoggedIn,
  locale,
}: UpdatesClientFeedProps) {
  const router = useRouter();
  const [updates, setUpdates] = useState<UpdateItem[]>(initialUpdates);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter updates
  const filtered = updates.filter((item) => {
    const matchesCat =
      selectedCategory === "all" ||
      item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.author_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const pinnedUpdates = filtered.filter((u) => u.is_pinned === 1);
  const regularUpdates = filtered.filter((u) => u.is_pinned !== 1);

  const handleCreated = (slug: string) => {
    setIsModalOpen(false);
    router.push(`/updates/${slug}`);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Header & Post Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E0E10] p-4 sm:p-5 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded-lg bg-[#D7B558]/10 text-[#D7B558]">
              <Newspaper className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#F2EFE8]">
              {t(locale, "interface.news_official_updates")}
            </h1>
          </div>
          <p className="text-xs text-[#8F8B83]">
            {t(locale, "interface.discover_the_latest_patches_features_and_official_racket_rpg_announcements")}
          </p>
        </div>

        {canPost && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold text-xs rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t(locale, "interface.publish_update")}</span>
          </button>
        )}
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0E0E10] p-3 rounded-xl">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {CATEGORY_TABS.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#D7B558] text-[#08080A]"
                    : "text-[#B4AFA4] hover:text-[#F2EFE8] hover:bg-[#18181B]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-[#8F8B83] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(locale, "interface.search_updates")}
            className="w-full pl-8 pr-3 py-1.5 bg-[#141417] rounded-lg text-xs text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:ring-1 focus:ring-[#D7B558] transition-colors"
          />
        </div>
      </div>

      {/* Pinned / Featured Updates */}
      {pinnedUpdates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#D7B558] uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5" />
            <span>{t(locale, "interface.pinned_important")}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedUpdates.map((item) => {
              const catBadge = getCategoryBadge(item.category);
              const avatarUrl = getPedAvatarUrl(item.author_skin);

              return (
                <Link
                  key={item.id}
                  href={`/updates/${item.slug}`}
                  className="group relative flex flex-col justify-between bg-[#0E0E10] hover:bg-[#141418] rounded-xl p-5 transition-colors overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${catBadge.bg}`}>
                        {catBadge.label}
                      </span>
                      <span className="flex items-center space-x-1 text-[11px] text-[#8F8B83] font-mono">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(item.created_at, locale)}</span>
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-[#F2EFE8] group-hover:text-[#D7B558] transition-colors line-clamp-2">
                      {item.title}
                    </h2>

                    {item.summary && (
                      <p className="text-xs text-[#B4AFA4] leading-relaxed line-clamp-3">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-border/60 text-[11px] text-[#8F8B83]">
                    <div className="flex items-center space-x-2 font-medium text-[#D8D4CA]">
                      <div className="w-6 h-6 rounded-full bg-[#1A1A1E] overflow-hidden flex items-center justify-center shrink-0">
                        {avatarUrl ? (
                          <GTAImage
                            src={avatarUrl}
                            alt={item.author_name}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <User className="w-3 h-3 text-[#D7B558]" />
                        )}
                      </div>
                      <span className="font-semibold">{item.author_name}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <ReactionBar item={item} isLoggedIn={isLoggedIn} />
                      <span className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{item.views_count}</span>
                      </span>
                      <span className="flex items-center space-x-1 text-[#D7B558] font-bold">
                        <span>{t(locale, "interface.read")}</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular Feed Grid */}
      <div className="space-y-3">
        {pinnedUpdates.length > 0 && regularUpdates.length > 0 && (
          <div className="flex items-center space-x-2 text-xs font-bold text-[#8F8B83] uppercase tracking-wider pt-2">
            <Newspaper className="w-3.5 h-3.5" />
            <span>{t(locale, "interface.all_posts")}</span>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#0E0E10] rounded-xl space-y-2">
            <Newspaper className="w-8 h-8 text-[#5A5751] mx-auto" />
            <p className="text-sm font-semibold text-[#8F8B83]">
              {t(locale, "interface.no_updates_found")}
            </p>
            {canPost && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs text-[#D7B558] hover:underline"
              >
                {t(locale, "interface.be_the_first_to_publish_an_update")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularUpdates.map((item) => {
              const catBadge = getCategoryBadge(item.category);
              const avatarUrl = getPedAvatarUrl(item.author_skin);

              return (
                <Link
                  key={item.id}
                  href={`/updates/${item.slug}`}
                  className="group flex flex-col justify-between bg-[#0E0E10] hover:bg-[#141418] rounded-xl p-4 transition-colors"
                >
                  <div className="space-y-2.5">
                    {item.cover_image && (
                      <div className="w-full h-36 rounded-lg overflow-hidden bg-[#08080A] mb-2">
                        <img
                          src={item.cover_image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${catBadge.bg}`}>
                        {catBadge.label}
                      </span>
                      <span className="text-[11px] text-[#8F8B83] font-mono">
                        {formatDate(item.created_at, locale)}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#F2EFE8] group-hover:text-[#D7B558] transition-colors line-clamp-2">
                      {item.title}
                    </h3>

                    {item.summary && (
                      <p className="text-xs text-[#8F8B83] leading-relaxed line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-surface-border/60 text-[11px] text-[#8F8B83]">
                    <ReactionBar item={item} isLoggedIn={isLoggedIn} />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-medium text-[#B4AFA4]">
                        <div className="w-5 h-5 rounded-full bg-[#1A1A1E] overflow-hidden flex items-center justify-center shrink-0">
                          {avatarUrl ? (
                            <GTAImage
                              src={avatarUrl}
                              alt={item.author_name}
                              width={20}
                              height={20}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <User className="w-3 h-3 text-[#D7B558]" />
                          )}
                        </div>
                        <span className="font-semibold">{item.author_name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center space-x-1">
                          <Eye className="w-3 h-3" />
                          <span>{item.views_count}</span>
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#D7B558] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for posting */}
      {canPost && (
        <PostUpdateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleCreated}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
