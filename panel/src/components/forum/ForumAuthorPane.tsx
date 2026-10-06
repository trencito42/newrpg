import type { ReactNode } from "react";
import Link from "next/link";
import { Shield, Wrench } from "lucide-react";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";
import { t } from "@/lib/i18n";

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
  inline,
}: {
  showAdminBadge: boolean;
  showHelperBadge: boolean;
  inline?: boolean;
}) {
  if (!showAdminBadge && !showHelperBadge) return null;
  const text = inline ? "text-[11px]" : "text-[10px]";
  const icon = inline ? "w-3 h-3" : "w-2.5 h-2.5";
  return (
    <span className={`inline-flex items-center gap-0.5 ${text} font-bold uppercase tracking-wide`}>
      {showAdminBadge ? (
        <span className="flex items-center gap-0.5 text-red-400">
          <Shield className={icon} /> Admin
        </span>
      ) : (
        <span className="flex items-center gap-0.5 text-blue-400">
          <Wrench className={icon} /> Helper
        </span>
      )}
    </span>
  );
}

export function ForumAuthorPane({
  identity,
  postCount = 0,
  joinedAt,
  adminLevel = 0,
  helperLevel = 0,
  locale,
  variant = "desktop",
}: ForumAuthorPaneProps) {
  const profileHref = `/players/${encodeURIComponent(identity.username.trim().replace(/\s+/g, "_"))}`;
  const avatarUrl = identity.skin ? getPedAvatarUrl(identity.skin) : null;
  const showAdminBadge = (adminLevel ?? 0) >= 1;
  const showHelperBadge = !showAdminBadge && (helperLevel ?? 0) >= 1;

  const metaParts: { key: string; node: ReactNode }[] = [];
  if (showAdminBadge || showHelperBadge) {
    metaParts.push({
      key: "staff",
      node: <StaffBadge showAdminBadge={showAdminBadge} showHelperBadge={showHelperBadge} inline />,
    });
  }
  if (identity.factionLabel) {
    metaParts.push({
      key: "faction",
      node: (
        <span className="truncate max-w-[140px]" style={{ color: identity.factionColor || undefined }}>
          {identity.factionLabel}
        </span>
      ),
    });
  }
  if (identity.clanName) {
    metaParts.push({
      key: "clan",
      node: <span className="truncate max-w-[160px]">{identity.clanName}</span>,
    });
  }

  if (variant === "mobile") {
    return (
      <header className="bg-surface-200 px-4 py-3 max-sm:block sm:hidden border-b border-border/50">
        <div className="flex gap-3 items-start">
          <Link
            href={profileHref}
            className="flex-shrink-0 rounded-full overflow-hidden ring-1 ring-border hover:ring-brand/50 transition-colors mt-0.5"
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
                <span className="text-base font-extrabold text-brand">
                  {identity.username[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0 flex flex-col items-stretch text-left gap-1">
            <PlayerIdentity
              username={identity.username}
              factionId={identity.factionId}
              factionColor={identity.factionColor}
              clanTag={identity.clanTag}
              clanColor={identity.clanColor}
              clanTagStyle={identity.clanTagStyle}
              href={profileHref}
              size="md"
              className="!justify-start text-[15px] font-semibold truncate w-full"
            />

            {metaParts.length > 0 ? (
              <p className="text-xs text-muted-foreground leading-snug flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {metaParts.map((part, i) => (
                  <span key={part.key} className="inline-flex items-center gap-x-1.5 min-w-0">
                    {i > 0 ? <span className="text-border/80 select-none">·</span> : null}
                    {part.node}
                  </span>
                ))}
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground pt-1">
              <span className="text-foreground/90 font-medium tabular-nums">{postCount}</span>
              {t(locale, "forumUi.posts_suffix")}
              {joinedAt ? (
                <>
                  <span className="mx-1.5 text-border">·</span>
                  {t(locale, "forumUi.joined_prefix")}
                  <span className="text-foreground/90 font-medium tabular-nums">{joinedYear(joinedAt)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </header>
    );
  }

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
        <div className="mt-1">
          <StaffBadge showAdminBadge={showAdminBadge} showHelperBadge={showHelperBadge} />
        </div>
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
          {postCount} {t(locale, "forumUi.posts")}
        </p>
        {joinedAt ? (
          <p className="text-[10px] text-muted-foreground">
            {t(locale, "forumUi.joined")} {joinedYear(joinedAt)}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
