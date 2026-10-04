import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { GalleryClient } from "./GalleryClient";

export const dynamic = "force-dynamic";

interface GalleryRow extends RowDataPacket {
  gallery_id: number;
  media_id: number;
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface GalleryItem {
  galleryId: number;
  mediaId: number;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export default async function GalleryPage() {
  const [locale, session] = await Promise.all([getViewerLocale(), getCurrentSession()]);

  if (!session || !session.selectedCharacterId) {
    redirect("/login");
  }
  const charId = session.selectedCharacterId;

  const rows = await dbQuery<GalleryRow>(
    `SELECT pg.id AS gallery_id, pg.media_id, pm.url, pm.thumbnail_url, pm.width, pm.height, pm.mime_type, pg.created_at
     FROM phone_gallery pg
     JOIN phone_media pm ON pm.id = pg.media_id
     WHERE pg.character_id = ? AND pg.deleted_at IS NULL AND pm.deleted_at IS NULL
     ORDER BY pg.created_at DESC`,
    [charId]
  );

  const items: GalleryItem[] = rows.map((r) => ({
    galleryId: r.gallery_id,
    mediaId: r.media_id,
    url: r.url,
    thumbnailUrl: r.thumbnail_url,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#F2EFE8]">{t(locale, "nav.gallery")}</h1>
        <p className="text-sm text-[#8F8B83] mt-1">{items.length} {t(locale, "feed.photo_count_label")}</p>
      </div>
      <GalleryClient items={items} isLoggedIn={!!session} locale={locale} />
    </div>
  );
}
