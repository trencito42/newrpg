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
  variant?: "desktop" | "mobile";
}

function joinedYear(dateStr: string) {
  return new Date(dateStr).getFullYear();
}

function StaffBadge({
  showAdminBadge,
  showHelperBadge,
  compact,
}: {
  showAdminBadge: boolean;
  showHelperBadge: boolean;
  compact?: boolean;
}) {
  if (!showAdminBadge && !showHelperBadge) return null;
  const text = compact ? "text-xs" : "text-[10px]";
  const icon = compact ? "w-3 h-3" : "w-2.5 h-2.5";
  return (
    <div className={`flex items-center gap-1 flex-wrap ${compact ? "mt-0.5" : "mt-1 justify-center"}`}>
      {showAdminBadge ? (
        <span
          className={`flex items-center gap-0.5 ${text} text-red-400 font-bold uppercase tracking-wide`}
        >
          <Shield className={icon} /> Admin
        </span>
      ) : null}
      {showHelperBadge ? (
        <span
          className={`flex items-center gap-0.5 ${text} text-blue-400 font-bold uppercase tracking-wide`}
        >
          <Wrench className={icon} /> Helper
        </span>
      ) : null}
    </div>
  );
}

export function ForumAuthorPane({
  identity,
  postCount = 0,
  joinedAt,
  adminLevel = 0,
  helperLevel = 0,
  variant = "desktop",
}: ForumAuthorPaneProps) {
  const profileHref = `/players/${encodeURIComponent(identity.username.trim().replace(/\s+/g, "_"))}`;
  const avatarUrl = identity.skin ? getPedAvatarUrl(identity.skin) : null;
  const showAdminBadge = (adminLevel ?? 0) >= 1;
  const showHelperBadge = !showAdminBadge && (helperLevel ?? 0) >= 1;

  if (variant === "mobile") {
    return (
      <header className="bg-surface-200 px-4 py-3.5 max-sm:block sm:hidden">
        <div className="flex gap-3 items-start">
          <Link
            href={profileHref}
            className="flex-shrink-0 rounded-full overflow-hidden ring-1 ring-border hover:ring-brand/50 transition-colors"
          >
            {avatarUrl ? (
              <GTAImage
                src={avatarUrl}
                alt=""
                width={48}
                height={48}
                className="w-11 h-11 object-cover object-top"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-surface-300 flex items-center justify-center">
                <span className="text-base font-extrabold text-brand">
                  {identity.username[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0 text-left">
            <PlayerIdentity
              username={identity.username}
              factionId={identity.factionId}
              factionColor={identity.factionColor}
              clanTag={identity.clanTag}
              clanColor={identity.clanColor}
              clanTagStyle={identity.clanTagStyle}
              href={profileHref}
              size="md"
              className="text-sm font-semibold truncate max-w-full"
            />
            <StaffBadge
              showAdminBadge={showAdminBadge}
              showHelperBadge={showHelperBadge}
              compact
            />
            {identity.factionLabel ? (
              <p
                className="text-xs text-muted-foreground mt-1 truncate"
                style={{ color: identity.factionColor || undefined }}
              >
                {identity.factionLabel}
              </p>
            ) : null}
            {identity.clanName && identity.clanTag ? (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{identity.clanName}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-2.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <span className="text-foreground font-medium tabular-nums">{postCount}</span> {"posts"}
          </span>
          {joinedAt ? (
            <>
              <span className="text-border">·</span>
              <span>
                {"Joined"}{" "}
                <span className="text-foreground font-medium tabular-nums">{joinedYear(joinedAt)}</span>
              </span>
            </>
          ) : null}
        </div>
        <div className="mt-3 border-t border-border/60" aria-hidden="true" />
      </header>
    );
  }

  /* Desktop — unchanged visual (≥600px sidebar column) */
  return (
    <aside
      className="hidden sm:flex w-44 flex-shrink-0 bg-surface-200 p-4 flex-col items-center gap-2 border-r border-border text-center"
    >
      <Link
        href={profileHref}
        className="flex-shrink-0 rounded-full overflow-hidden ring-1 ring-border hover:ring-brand/50 transition-colors"
      >
        {avatarUrl ? (
          <GTAImage
            src={avatarUrl}
            alt=""
            width={48}
            height={48}
            className="w-12 h-12 object-cover object-top"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-surface-300 flex items-center justify-center">
            <span className="text-lg font-extrabold text-brand">
              {identity.username[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}
      </Link>
      <div className="min-w-0 w-full flex flex-col items-center">
        <PlayerIdentity
          username={identity.username}
          factionId={identity.factionId}
          factionColor={identity.factionColor}
          clanTag={identity.clanTag}
          clanColor={identity.clanColor}
          clanTagStyle={identity.clanTagStyle}
          href={profileHref}
          size="sm"
          className="truncate max-w-full justify-center"
        />
        <StaffBadge showAdminBadge={showAdminBadge} showHelperBadge={showHelperBadge} />
        {identity.factionLabel ? (
          <p
            className="text-[10px] text-muted-foreground mt-0.5 truncate"
            style={{ color: identity.factionColor || undefined }}
          >
            {identity.factionLabel}
          </p>
        ) : null}
        {identity.clanName && identity.clanTag ? (
          <p className="text-[10px] text-muted-foreground truncate">{identity.clanName}</p>
        ) : null}
        <p className="text-[10px] text-muted-foreground mt-1">
          {postCount} {"posts"}
        </p>
        {joinedAt ? (
          <p className="text-[10px] text-muted-foreground">
            {"Joined"} {joinedYear(joinedAt)}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
