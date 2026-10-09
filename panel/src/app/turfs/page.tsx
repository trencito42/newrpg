import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { TurfsBrowser } from "./TurfsBrowser";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.turfs_title"),
    description: t(locale, "seo.turfs_description"),
    path: "/turfs",
  });
}

interface TurfRow extends RowDataPacket {
  id: number;
  name: string;
  payout: number;
  owner_clan_id: number | null;
  clan_name: string | null;
  clan_tag: string | null;
  clan_color: string | null;
}

export default async function TurfsPage() {
  const locale = await getViewerLocale();

  const turfs = await dbQuery<TurfRow>(
    `SELECT t.id, t.name, t.payout, t.owner_clan_id, cl.name AS clan_name, cl.tag AS clan_tag, cl.tag_color AS clan_color
     FROM turfs t
     LEFT JOIN clans cl ON cl.id = t.owner_clan_id
     ORDER BY t.id ASC`
  );

  const controlledCount = turfs.filter((row) => row.owner_clan_id !== null).length;

  return (
    <TurfsBrowser
      locale={locale}
      controlledCount={controlledCount}
      turfs={turfs.map((row) => ({
        id: row.id,
        name: row.name,
        payout: row.payout,
        owner_clan_id: row.owner_clan_id,
        clan_name: row.clan_name,
        clan_tag: row.clan_tag,
        clan_color: row.clan_color,
      }))}
    />
  );
}
