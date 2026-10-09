import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { UpdatesClientFeed, UpdateItem } from "./UpdatesClientFeed";
import { RowDataPacket } from "mysql2";
import { buildMetadata } from "@/lib/seo/metadata";
import { t } from "@/lib/i18n";
import { playerIdentityKey, resolvePlayerIdentitiesByRefs } from "@/lib/player-identity";
import {
  updateMyReactionSubquery,
  updateReactionCountSubquery,
} from "@/lib/update-reaction-counts";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.updates_title"),
    description: t(locale, "seo.updates_description"),
    path: "/updates",
  }, locale);
}

interface RawUpdateRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  cover_image: string | null;
  author_account_id: number;
  author_name: string;
  is_pinned: number;
  views_count: number;
  likes_count: number;
  dislikes_count: number;
  my_reaction: string | null;
  created_at: string;
  author_metadata?: string | Record<string, any> | null;
}

export default async function UpdatesPage() {
  const [session, locale] = await Promise.all([
    getCurrentSession(),
    getViewerLocale(),
  ]);

  const canPost = Boolean(session && (session.adminLevel >= 1 || session.isAuthor));
  const isAdmin = Boolean(session && session.adminLevel >= 1);
  const isLoggedIn = Boolean(session);
  const accountId = session?.accountId ?? null;

  const rawUpdates = await dbQuery<RawUpdateRow>(
    `SELECT u.id, u.slug, u.title, u.summary, u.category, u.cover_image, u.author_account_id, u.author_name, u.is_pinned, u.views_count, u.created_at,
            c.metadata as author_metadata,
            ${updateReactionCountSubquery("u.id", "like")} AS likes_count,
            ${updateReactionCountSubquery("u.id", "dislike")} AS dislikes_count,
            ${updateMyReactionSubquery("u.id")} AS my_reaction
     FROM panel_updates u
     LEFT JOIN players p ON p.account_id = u.author_account_id
     LEFT JOIN characters c ON c.id = (
       SELECT c2.id FROM characters c2
       WHERE c2.player_id = p.id
       ORDER BY c2.level DESC, c2.slot ASC, c2.id DESC
       LIMIT 1
     )
     ORDER BY u.is_pinned DESC, u.created_at DESC
     LIMIT 50`,
    [accountId ?? 0, accountId ?? 0]
  );

  const authorIdentities = await resolvePlayerIdentitiesByRefs(
    rawUpdates.map((item) => ({
      accountId: item.author_account_id,
      username: item.author_name,
    }))
  );

  const updates: UpdateItem[] = rawUpdates.map((item) => {
    const identity = authorIdentities.get(playerIdentityKey(item.author_account_id));
    let authorSkin: string | null = identity?.skin ?? null;
    if (!authorSkin && item.author_metadata) {
      try {
        const meta = typeof item.author_metadata === "string" ? JSON.parse(item.author_metadata) : item.author_metadata;
        if (meta?.skin) authorSkin = String(meta.skin);
      } catch {}
    }

    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      category: item.category,
      cover_image: item.cover_image,
      author_account_id: item.author_account_id,
      author_name: item.author_name,
      author_skin: authorSkin,
      author_faction_id: identity?.factionId ?? null,
      author_clan_tag: identity?.clanTag ?? null,
      author_clan_color: identity?.clanColor ?? null,
      author_clan_tag_style: identity?.clanTagStyle ?? null,
      is_pinned: item.is_pinned,
      views_count: item.views_count,
      likes_count: Number(item.likes_count ?? 0),
      dislikes_count: Number(item.dislikes_count ?? 0),
      my_reaction: item.my_reaction ?? null,
      created_at: item.created_at,
    };
  });

  return (
    <div className="w-full space-y-5">
      <UpdatesClientFeed
        initialUpdates={updates}
        canPost={canPost}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
        locale={locale}
      />
    </div>
  );
}
