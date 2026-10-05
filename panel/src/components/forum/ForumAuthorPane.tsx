import Link from "next/link";
import { Shield, Wrench } from "lucide-react";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";

export interface ForumAuthorPaneProps {
  identity: ResolvedPlayerIdentity;
  postCount?: number;
  joinedAt?: string | null;
  adminLevel?: number;
  helperLevel?: number;
  locale: "en" | "ro";
}

function joinedYear(dateStr: string) {
  return new Date(dateStr).getFullYear();
}

export function ForumAuthorPane({
  identity,
  postCount = 0,
  joinedAt,
  adminLevel = 0,
  helperLevel = 0,
}: ForumAuthorPaneProps) {
  const profileHref = `/players/${encodeURIComponent(identity.username.trim().replace(/\s+/g, "_"))}`;
  const avatarUrl = identity.skin ? getPedAvatarUrl(identity.skin) : null;

  return (
    <div className="w-full sm:w-44 flex-shrink-0 bg-surface-200 p-4 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 border-b sm:border-b-0 sm:border-r border-border">
      <Link href={profileHref} className="flex-shrink-0 rounded-full overflow-hidden ring-1 ring-border hover:ring-brand/50 transition-colors">
        {avatarUrl ? (
          <GTAImage src={avatarUrl} alt="" width={48} height={48} className="w-10 h-10 sm:w-12 sm:h-12 object-cover object-top" />
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-300 flex items-center justify-center">
            <span className="text-lg font-extrabold text-brand">
              {identity.username[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}
      </Link>
      <div className="flex-1 sm:flex-none min-w-0 w-full">
        <PlayerIdentity
          username={identity.username}
          factionId={identity.factionId}
          factionColor={identity.factionColor}
          clanTag={identity.clanTag}
          clanColor={identity.clanColor}
          clanTagStyle={identity.clanTagStyle}
          href={profileHref}
          size="sm"
          className="truncate max-w-full"
        />
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {adminLevel >= 1 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-400 font-bold uppercase tracking-wide">
              <Shield className="w-2.5 h-2.5" /> Admin
            </span>
          )}
          {adminLevel === 0 && helperLevel >= 1 && (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-400 font-bold uppercase tracking-wide">
              <Wrench className="w-2.5 h-2.5" /> Helper
            </span>
          )}
        </div>
        {identity.factionLabel && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" style={{ color: identity.factionColor || undefined }}>
            {identity.factionLabel}
          </p>
        )}
        {identity.clanName && identity.clanTag && (
          <p className="text-[10px] text-muted-foreground truncate">
            {identity.clanName}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {postCount} {"posts"}
        </p>
        {joinedAt && (
          <p className="text-[10px] text-muted-foreground">
            {"Joined"} {joinedYear(joinedAt)}
          </p>
        )}
      </div>
    </div>
  );
}
