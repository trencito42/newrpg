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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {t(locale, "turfs.title")}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {t(locale, "turfs.subtitle")}
        </p>
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
