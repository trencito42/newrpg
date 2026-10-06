import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { FeedClient } from "./FeedClient";
import { buildMetadata } from "@/lib/seo";
import { fetchSocialFeedPosts } from "@/lib/social-feed";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.feed_title"),
    path: "/feed",
    noIndex: true,
  });
}

export type { FeedPost } from "@/lib/social-feed";

interface ContactRow extends RowDataPacket {
  contact_character_id: number;
}

export default async function FeedPage() {
  const [locale, session] = await Promise.all([getViewerLocale(), getCurrentSession()]);
  const charId = session?.selectedCharacterId ?? null;

  const globalPosts = await fetchSocialFeedPosts({ limit: 20, viewerCharId: charId });

  let contactsPosts: Awaited<ReturnType<typeof fetchSocialFeedPosts>> = [];
  if (charId) {
    const contacts = await dbQuery<ContactRow>(
      "SELECT contact_character_id FROM phone_contacts WHERE character_id = ? AND contact_character_id IS NOT NULL",
      [charId]
    );
    const contactIds = contacts.map((r) => r.contact_character_id);
    if (contactIds.length > 0) {
      contactsPosts = await fetchSocialFeedPosts({
        characterIds: contactIds,
        limit: 20,
        viewerCharId: charId,
      });
    }
  }

  const nextGlobal = globalPosts.length === 20 ? globalPosts[globalPosts.length - 1].id : null;
  const nextContacts = contactsPosts.length === 20 ? contactsPosts[contactsPosts.length - 1].id : null;

  return (
    <div className="space-y-4 w-full">
      <div className="pb-2">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{t(locale, "nav.feed")}</h1>
      </div>
      <div className="max-w-[680px]">
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
    </div>
  );
}
