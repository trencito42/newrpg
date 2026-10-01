import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Map, Shield, DollarSign, Award } from "lucide-react";
import { RowDataPacket } from "mysql2";

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
  const totalHourlyPayout = turfs.reduce((sum, t) => sum + (Number(t.payout) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-surface-200 to-surface-200 border border-amber-500/30 p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-brand text-xs font-bold uppercase tracking-widest mb-1.5">
              <Map className="w-4 h-4 text-brand" />
              <span>{locale === "ro" ? "Războaie de Teritorii" : "Territory Conquest"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {t(locale, "turfs.title")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl leading-relaxed">
              {t(locale, "turfs.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-surface-100 border border-surface-border text-center shadow-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                {locale === "ro" ? "Teritorii Ocupate" : "Controlled Zones"}
              </span>
              <span className="text-base font-black font-mono text-brand">
                {controlledCount} / {turfs.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Turf Territories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {turfs.map((turf) => {
          const isControlled = turf.owner_clan_id !== null;
          return (
            <Card
              key={turf.id}
              className="flex flex-col justify-between hover:border-surface-borderLight transition-all"
            >
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={isControlled ? "brand" : "outline"}>
                      Zone #{turf.id}
                    </Badge>
                    <span className="font-mono text-xs text-emerald-400 font-bold">
                      {formatCurrency(turf.payout)} / hr
                    </span>
                  </div>
                  <CardTitle className="text-base mt-2">{turf.name}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 pt-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-surface-border/50">
                    <span className="text-gray-400">Controlling Clan</span>
                    {isControlled ? (
                      <span
                        className="font-bold flex items-center space-x-1"
                        style={{ color: turf.clan_color || "#f59e0b" }}
                      >
                        <span>[{turf.clan_tag}]</span>
                        <span className="text-gray-200">{turf.clan_name}</span>
                      </span>
                    ) : (
                      <span className="text-gray-500 font-mono">Unclaimed</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                    <span className="text-gray-400">Respect Bonus</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      +{turf.respect_payout} RP / Payday
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-gray-500 font-mono text-[11px]">
                    <span>Coordinates</span>
                    <span>
                      {Math.round(turf.x)}, {Math.round(turf.y)}
                    </span>
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
