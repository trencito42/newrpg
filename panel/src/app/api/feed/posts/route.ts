import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";

const MAX_POST_BODY = 500;
const FEED_PAGE_SIZE = 20;

function sanitizeBody(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().replace(/\r/g, "");
  if (!s) return null;
  return s.length > MAX_POST_BODY ? s.slice(0, MAX_POST_BODY) : s;
}

async function buildFeedQuery(opts: {
  characterIds?: number[] | null;
  beforeId?: number | null;
  limit: number;
  viewerCharId?: number | null;
}) {
  const { characterIds, beforeId, limit, viewerCharId } = opts;
  const params: any[] = [];
  let whereClauses = ["p.deleted_at IS NULL"];

  if (characterIds && characterIds.length > 0) {
    whereClauses.push(`p.character_id IN (${characterIds.map(() => "?").join(",")})`);
    params.push(...characterIds);
  }

  if (beforeId) {
    whereClauses.push("p.id < ?");
    params.push(beforeId);
  }

  const viewerId = viewerCharId ?? 0;
  params.push(viewerId);
  params.push(limit);

  const where = whereClauses.join(" AND ");

  interface PostRow extends RowDataPacket {
    id: number; character_id: number; firstname: string; lastname: string;
    faction_id: string | null; clan_tag: string | null; clan_color: string | null;
    clan_tag_style: string | null; author_skin: string | null;
    body: string | null; media_id: number | null; media_url: string | null;
    thumbnail_url: string | null; width: number | null; height: number | null;
    created_at: string; updated_at: string | null;
    likes_count: number; comments_count: number; liked_by_viewer: number;
  }

  const rows = await dbQuery<PostRow>(
    `SELECT p.id, p.character_id, c.firstname, c.lastname,
            JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction')) AS faction_id,
            JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.skin'))    AS author_skin,
            cl.tag AS clan_tag, cl.tag_color AS clan_color, cl.tag_style AS clan_tag_style,
            p.body, p.media_id,
            pm.url AS media_url, pm.thumbnail_url, pm.width, pm.height,
            p.created_at, p.updated_at,
            COALESCE(lk.likes_count, 0)    AS likes_count,
            COALESCE(cmt.comments_count, 0) AS comments_count,
            CASE WHEN vl.post_id IS NOT NULL THEN 1 ELSE 0 END AS liked_by_viewer
     FROM social_posts p
     JOIN characters c ON c.id = p.character_id
     LEFT JOIN phone_media pm ON pm.id = p.media_id AND pm.deleted_at IS NULL
     LEFT JOIN clan_members clanm ON clanm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = clanm.clan_id
     LEFT JOIN (SELECT post_id, COUNT(*) AS likes_count FROM social_post_likes GROUP BY post_id) lk ON lk.post_id = p.id
     LEFT JOIN (SELECT post_id, COUNT(*) AS comments_count FROM social_comments WHERE deleted_at IS NULL GROUP BY post_id) cmt ON cmt.post_id = p.id
     LEFT JOIN social_post_likes vl ON vl.post_id = p.id AND vl.character_id = ?
     WHERE ${where}
     ORDER BY p.id DESC
     LIMIT ?`,
    params
  );
  return rows;
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  const charId = session?.selectedCharacterId ?? null;

  const url = req.nextUrl;
  const feed = url.searchParams.get("feed") ?? "global";
  const beforeId = url.searchParams.get("before_id") ? parseInt(url.searchParams.get("before_id")!) : null;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 30);

  let characterIds: number[] | null = null;

  if (feed === "contacts") {
    if (!charId) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }
    interface ContactRow extends RowDataPacket { contact_character_id: number; }
    const contacts = await dbQuery<ContactRow>(
      "SELECT contact_character_id FROM phone_contacts WHERE character_id = ? AND contact_character_id IS NOT NULL",
      [charId]
    );
    characterIds = contacts.map((r) => r.contact_character_id);
    if (characterIds.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }
  }

  const posts = await buildFeedQuery({ characterIds, beforeId, limit, viewerCharId: charId });
  const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

  return NextResponse.json({ posts, nextCursor });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session?.selectedCharacterId) {
    return NextResponse.json({ error: "no_character" }, { status: 401 });
  }
  const charId = session.selectedCharacterId;

  let body: string | null = null;
  let mediaId: number | null = null;

  try {
    const json = await req.json();
    body = sanitizeBody(json.body);
    mediaId = json.media_id ? parseInt(json.media_id) : null;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body && !mediaId) {
    return NextResponse.json({ error: "empty_post" }, { status: 422 });
  }

  if (mediaId) {
    interface GalleryRow extends RowDataPacket { id: number; }
    const row = await dbQuerySingle<GalleryRow>(
      "SELECT pg.id FROM phone_gallery pg JOIN phone_media pm ON pm.id = pg.media_id WHERE pg.character_id = ? AND pg.media_id = ? AND pg.deleted_at IS NULL AND pm.deleted_at IS NULL LIMIT 1",
      [charId, mediaId]
    );
    if (!row) {
      return NextResponse.json({ error: "media_not_in_gallery" }, { status: 403 });
    }
  }

  const result = await dbExecute(
    "INSERT INTO social_posts (character_id, body, media_id) VALUES (?, ?, ?)",
    [charId, body, mediaId]
  );

  return NextResponse.json({ ok: true, postId: (result as any).insertId });
}
