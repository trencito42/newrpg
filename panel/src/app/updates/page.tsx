import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { UpdatesClientFeed, UpdateItem } from "./UpdatesClientFeed";
import { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Noutăți & Updates • Racket RPG",
  description: "Actualizări, patch notes și anunțuri oficiale pentru serverul Racket RPG.",
};

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

  const rawUpdates = await dbQuery<RawUpdateRow>(
    `SELECT u.id, u.slug, u.title, u.summary, u.category, u.cover_image, u.author_account_id, u.author_name, u.is_pinned, u.views_count, u.created_at,
            c.metadata as author_metadata
     FROM panel_updates u
     LEFT JOIN players p ON p.account_id = u.author_account_id
     LEFT JOIN characters c ON c.player_id = p.id
     ORDER BY u.is_pinned DESC, u.created_at DESC
     LIMIT 50`
  );

  const updates: UpdateItem[] = rawUpdates.map((item) => {
    let authorSkin: string | null = null;
    if (item.author_metadata) {
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
      is_pinned: item.is_pinned,
      views_count: item.views_count,
      created_at: item.created_at,
    };
  });

  return (
    <div className="w-full space-y-5">
      <UpdatesClientFeed
        initialUpdates={updates}
        canPost={canPost}
        isAdmin={isAdmin}
        locale={locale}
      />
    </div>
  );
}
