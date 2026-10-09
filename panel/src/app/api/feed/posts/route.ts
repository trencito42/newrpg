import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { fetchSocialFeedPosts } from "@/lib/social-feed";
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

  const posts = await fetchSocialFeedPosts({ characterIds, beforeId, limit, viewerCharId: charId });
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
