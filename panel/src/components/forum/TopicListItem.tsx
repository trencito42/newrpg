import Link from "next/link";
import { Lock, Pin, Megaphone, Globe, MessageSquare, Eye, Clock } from "lucide-react";
import type { ForumTopicListItem } from "@/lib/forum-types";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";

interface TopicListItemProps {
  topic: ForumTopicListItem;
  locale: "en" | "ro";
  showForum?: boolean;
  forumName?: string;
  forumSlug?: string;
  authorIdentity?: ResolvedPlayerIdentity;
  lastPosterIdentity?: ResolvedPlayerIdentity;
}

function formatRelative(dateStr: string | null, locale: "en" | "ro"): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function TypeIcon({ type, status }: { type: string; status: string }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (status === "locked") return <Lock className={`${cls} text-muted-foreground`} />;
  if (type === "global") return <Globe className={`${cls} text-brand`} />;
  if (type === "announcement") return <Megaphone className={`${cls} text-brand`} />;
  if (type === "pinned") return <Pin className={`${cls} text-muted-foreground`} />;
  return <MessageSquare className={`${cls} text-muted-foreground`} />;
}

export function TopicListItem({ topic, locale, showForum, forumName, forumSlug, authorIdentity, lastPosterIdentity }: TopicListItemProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-card hover:bg-surface-200 transition-colors ${topic.deleted_at ? "opacity-60" : ""}`}>
      <TypeIcon type={topic.type} status={topic.status} />

      {/* Unread dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          topic.is_unread ? "bg-brand" : "bg-transparent"
        }`}
      />

      {/* Title area */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/forum/topic/${topic.id}/${topic.slug}`}
          className="text-sm font-semibold text-foreground hover:text-brand transition-colors truncate block"
        >
          {topic.title}
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <PlayerIdentity {...authorIdentity} username={authorIdentity?.username ?? topic.author_username} size="sm" />
          {showForum && forumName && forumSlug && (
            <>
              <span>·</span>
              <Link href={`/forum/${forumSlug}`} className="hover:text-foreground transition-colors">
                {forumName}
              </Link>
            </>
          )}
          {topic.deleted_at && (
            <>
              <span>·</span>
              <span className="text-red-400">{"[deleted]"}</span>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          <span>{topic.reply_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          <span>{topic.view_count}</span>
        </div>
      </div>

      {/* Last post */}
      <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground flex-shrink-0 min-w-[80px]">
        {topic.last_post_at && (
          <>
            <PlayerIdentity {...lastPosterIdentity} username={lastPosterIdentity?.username ?? topic.last_post_username ?? ""} size="sm" className="truncate max-w-[80px]" />
            <Link href={`/forum/topic/${topic.id}/${topic.slug}${topic.last_post_id ? `#post-${topic.last_post_id}` : ""}`} className="flex items-center gap-1 hover:text-foreground">
              <Clock className="w-2.5 h-2.5" />
              <time dateTime={topic.last_post_at}>{formatRelative(topic.last_post_at, locale)}</time>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
