import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

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
  x: number;
  y: number;
  z: number;
  radius: number;
  payout: number;
  respect_payout: number;
  owner_clan_id: number | null;
  clan_name: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  polygon: string | null;
}

export default async function TurfsPage() {
  const locale = await getViewerLocale();

  const turfs = await dbQuery<TurfRow>(
    `SELECT t.id, t.name, t.x, t.y, t.z, t.radius, t.payout, t.respect_payout,
            t.owner_clan_id, cl.name AS clan_name, cl.tag AS clan_tag, cl.tag_color AS clan_color,
            t.polygon
     FROM turfs t
     LEFT JOIN clans cl ON cl.id = t.owner_clan_id
     ORDER BY t.id ASC`
  );

  const controlledCount = turfs.filter((t) => t.owner_clan_id !== null).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "turfs.title")}
          </h1>
          <p className="text-xs text-[#99958E] mt-0.5">
            {t(locale, "interface.18_contested_territories_across_san_andreas")}</p>
        </div>

        <span className="font-mono text-xs text-[#B4AFA4] bg-surface-100 border border-surface-border px-2.5 py-1 rounded w-fit">
          {controlledCount} / {turfs.length} {t(locale, "interface.controlled")}</span>
      </div>

      {/* Grid of Turf Territories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {turfs.map((turf) => {
          const isControlled = turf.owner_clan_id !== null;
          return (
            <div
              key={turf.id}
              className="p-3 bg-surface-100 border border-surface-border rounded flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#8F8B83]">
                    {t(locale, "interface.territory")}{turf.id}
                  </span>
                  <span className="font-mono text-xs text-[#F2EFE8]">
                    {formatCurrency(turf.payout)} {t(locale, "interface.hr")}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#F2EFE8] mt-1">
                  {turf.name}
                </h3>
              </div>

              <div className="mt-3 pt-2 border-t border-surface-border/60 flex items-center justify-between text-xs text-[#8F8B83]">
                <span>{t(locale, "interface.clan")}</span>
                {isControlled ? (
                  <span
                    className="font-semibold"
                    style={{ color: turf.clan_color || "#F2EFE8" }}
                  >
                    [{turf.clan_tag || turf.clan_name}]
                  </span>
                ) : (
                  <span className="text-[#8F8B83] italic">{t(locale, "interface.unclaimed")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
