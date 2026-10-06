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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{t(locale, "turfs.title")}</h1>
          <p className="text-xs text-[#99958E] mt-1">
            {t(locale, "interface.18_contested_territories_across_san_andreas")}
          </p>
        </div>
        <span className="font-mono text-xs text-[#B4AFA4] bg-[#0E0E10] px-3 py-1.5 rounded-lg w-fit">
          {controlledCount} / {turfs.length} {t(locale, "interface.controlled")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {turfs.map((turf) => {
          const isControlled = turf.owner_clan_id !== null;
          return (
            <div
              key={turf.id}
              className="p-4 bg-[#0E0E10] rounded-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-[#8F8B83] uppercase tracking-wider">
                    {t(locale, "interface.territory")}{turf.id}
                  </span>
                  <span className="font-mono text-xs text-[#D7B558]">
                    {formatCurrency(turf.payout)} {t(locale, "interface.hr")}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#F2EFE8] mt-2">{turf.name}</h3>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs text-[#8F8B83]">
                <span>{t(locale, "interface.clan")}</span>
                {isControlled ? (
                  <span className="font-semibold" style={{ color: turf.clan_color || "#F2EFE8" }}>
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
