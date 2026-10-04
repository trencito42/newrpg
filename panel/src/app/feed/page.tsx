import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { FeedClient } from "./FeedClient";

export const dynamic = "force-dynamic";

export interface FeedPost {
  id: number;
  character_id: number;
  firstname: string;
  lastname: string;
  body: string | null;
  media_id: number | null;
  media_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_viewer: number;
}

interface PostRow extends RowDataPacket, FeedPost {}

async function fetchFeed(opts: {
  characterIds?: number[] | null;
  beforeId?: number | null;
  limit: number;
  viewerCharId?: number | null;
}): Promise<FeedPost[]> {
  const { characterIds, beforeId, limit, viewerCharId } = opts;
  const params: any[] = [];
  const whereClauses = ["p.deleted_at IS NULL"];

  if (characterIds && characterIds.length > 0) {
    whereClauses.push(`p.character_id IN (${characterIds.map(() => "?").join(",")})`);
    params.push(...characterIds);
  }

  if (beforeId) {
    whereClauses.push("p.id < ?");
    params.push(beforeId);
  }

  params.push(viewerCharId ?? 0);
  params.push(limit);

  return dbQuery<PostRow>(
    `SELECT p.id, p.character_id, c.firstname, c.lastname,
            p.body, p.media_id,
            pm.url AS media_url, pm.thumbnail_url, pm.width, pm.height,
            p.created_at, p.updated_at,
            COALESCE(lk.likes_count, 0) AS likes_count,
            COALESCE(cm.comments_count, 0) AS comments_count,
            CASE WHEN vl.post_id IS NOT NULL THEN 1 ELSE 0 END AS liked_by_viewer
     FROM social_posts p
     JOIN characters c ON c.id = p.character_id
     LEFT JOIN phone_media pm ON pm.id = p.media_id AND pm.deleted_at IS NULL
     LEFT JOIN (SELECT post_id, COUNT(*) AS likes_count FROM social_post_likes GROUP BY post_id) lk ON lk.post_id = p.id
     LEFT JOIN (SELECT post_id, COUNT(*) AS comments_count FROM social_comments WHERE deleted_at IS NULL GROUP BY post_id) cm ON cm.post_id = p.id
     LEFT JOIN social_post_likes vl ON vl.post_id = p.id AND vl.character_id = ?
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY p.id DESC
     LIMIT ?`,
    params
  );
}

export default async function FeedPage() {
  const [locale, session] = await Promise.all([getViewerLocale(), getCurrentSession()]);
  const charId = session?.selectedCharacterId ?? null;

  const globalPosts = await fetchFeed({ limit: 20, viewerCharId: charId });

  let contactsPosts: FeedPost[] = [];
  if (charId) {
    interface ContactRow extends RowDataPacket { contact_character_id: number; }
    const contacts = await dbQuery<ContactRow>(
      "SELECT contact_character_id FROM phone_contacts WHERE character_id = ? AND contact_character_id IS NOT NULL",
      [charId]
    );
    const contactIds = contacts.map((r) => r.contact_character_id);
    if (contactIds.length > 0) {
      contactsPosts = await fetchFeed({ characterIds: contactIds, limit: 20, viewerCharId: charId });
    }
  }

  const nextGlobal = globalPosts.length === 20 ? globalPosts[globalPosts.length - 1].id : null;
  const nextContacts = contactsPosts.length === 20 ? contactsPosts[contactsPosts.length - 1].id : null;

  return (
    <div className="max-w-[680px] mx-auto">
      <h1 className="text-xl font-bold text-[#F2EFE8] mb-6">
        {t(locale, "nav.feed")}
      </h1>
      <FeedClient
        locale={locale}
        initialGlobal={globalPosts}
        initialContacts={contactsPosts}
        nextGlobalCursor={nextGlobal}
        nextContactsCursor={nextContacts}
        isLoggedIn={!!session}
        viewerCharId={charId}
        viewerCharName={session?.selectedCharacterName ?? null}
      />
    </div>
  );
}
