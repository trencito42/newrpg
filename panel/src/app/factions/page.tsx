import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Shield, Users, ArrowRight, UserCheck } from "lucide-react";
import { RowDataPacket } from "mysql2";

// Authoritative factions data matching sunset_core/shared/factions.lua
const STATIC_FACTIONS = [
  {
    id: "police",
    label: "LSPD",
    type: "legal" as const,
    factionType: "Law Enforcement",
    description: "Los Santos Police Department — city patrol, emergency response, citations, and felony arrests.",
  },
  {
    id: "sheriff",
    label: "San Andreas Sheriff",
    type: "legal" as const,
    factionType: "Law Enforcement",
    description: "County sheriff department — rural patrol, robbery containment, warrants, and high-speed pursuits.",
  },
  {
    id: "fib",
    label: "Federal Investigation Bureau",
    type: "legal" as const,
    factionType: "Federal Intelligence",
    description: "Federal Bureau — intelligence gathering, anti-corruption, major drug trafficking, and tactical raids.",
  },
  {
    id: "medic",
    label: "Pillbox EMS",
    type: "legal" as const,
    factionType: "Medical Rescue",
    description: "Emergency medical services — trauma response, patient stabilization, field triage, and citywide revivals.",
  },
  {
    id: "lsfd",
    label: "LS Fire Department",
    type: "legal" as const,
    factionType: "Fire Rescue",
    description: "Fire and rescue — heavy vehicle extraction, chemical spills, structure fires, and paramedic backup.",
  },
  {
    id: "taxi",
    label: "Downtown Cab Co.",
    type: "legal" as const,
    factionType: "Public Transit",
    description: "Official municipal taxi service — passenger transportation across San Andreas via phone dispatch.",
  },
  {
    id: "mechanic",
    label: "LS Customs",
    type: "legal" as const,
    factionType: "Automotive Service",
    description: "Licensed vehicle workshop — roadside repairs, engine overhauls, tow services, and ECU tuning.",
  },
  {
    id: "lssi",
    label: "LSSI — License & Safety",
    type: "legal" as const,
    factionType: "Education & Licensing",
    description: "Safety Institute — certified pilot exams, boat licenses, and firearm certification tests.",
  },
  {
    id: "sunset_cartel",
    label: "Sunset Cartel",
    type: "illegal" as const,
    factionType: "Criminal Syndicate",
    description: "Organized narcotic syndicate — lab synthesis, distribution routes, smuggling, and turf dominance.",
  },
  {
    id: "night_syndicate",
    label: "Night Syndicate",
    type: "illegal" as const,
    factionType: "Underground Network",
    description: "Underground street syndicate — weapons fabrication, illegal fencing, vehicle chop, and contract operations.",
  },
];

interface FactionStatsRow extends RowDataPacket {
  job: string;
  member_count: number;
}

interface LeaderRow extends RowDataPacket {
  faction_id: string;
  leader_name: string;
  character_id: number;
}

interface MotdRow extends RowDataPacket {
  faction_id: string;
  message: string;
}

export default async function FactionsPage() {
  const locale = await getViewerLocale();

  // Load real member counts per faction
  const memberCounts = await dbQuery<FactionStatsRow>(
    `SELECT job, COUNT(*) AS member_count 
     FROM characters 
     WHERE job IN (${STATIC_FACTIONS.map(() => "?").join(",")})
     GROUP BY job`,
    STATIC_FACTIONS.map((f) => f.id)
  );

  const memberMap = new Map(memberCounts.map((m) => [m.job, Number(m.member_count) || 0]));

  // Load real assigned leaders
  const leaders = await dbQuery<LeaderRow>(
    `SELECT fl.faction_id, fl.character_id, CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS leader_name
     FROM faction_leaders fl
     JOIN characters c ON c.id = fl.character_id`
  );

  const leaderMap = new Map(leaders.map((l) => [l.faction_id, l]));

  // Load real MOTD
  const motds = await dbQuery<MotdRow>("SELECT faction_id, message FROM faction_motd");
  const motdMap = new Map(motds.map((m) => [m.faction_id, m.message]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {t(locale, "factions.title")}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {t(locale, "factions.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STATIC_FACTIONS.map((f) => {
          const members = memberMap.get(f.id) || 0;
          const leader = leaderMap.get(f.id);
          const motd = motdMap.get(f.id);

          return (
            <Card
              key={f.id}
              className="flex flex-col justify-between hover:border-surface-borderLight transition-all"
            >
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={f.type === "legal" ? "success" : "danger"}>
                      {f.type === "legal"
                        ? t(locale, "factions.type_legal")
                        : t(locale, "factions.type_illegal")}
                    </Badge>
                    <span className="text-[11px] font-mono text-gray-400">
                      {f.factionType}
                    </span>
                  </div>
                  <CardTitle className="text-lg mt-2">{f.label}</CardTitle>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {f.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-surface-border/50">
                    <span className="text-gray-400 flex items-center space-x-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-brand" />
                      <span>{t(locale, "factions.leader")}</span>
                    </span>
                    <span className="font-semibold text-gray-200">
                      {leader ? (
                        <Link
                          href={`/players/${leader.character_id}`}
                          className="text-brand hover:underline"
                        >
                          {leader.leader_name}
                        </Link>
                      ) : (
                        <span className="text-gray-500 font-normal">
                          {t(locale, "factions.no_leader")}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1 border-b border-surface-border/50">
                    <span className="text-gray-400 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>{t(locale, "factions.members")}</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {members} Active
                    </span>
                  </div>

                  {motd && (
                    <div className="p-2.5 rounded-lg bg-surface-100 border border-surface-border text-xs text-gray-300 italic">
                      &quot;{motd}&quot;
                    </div>
                  )}
                </CardContent>
              </div>

              <div className="pt-3 mt-3 border-t border-surface-border flex items-center justify-end">
                <Link
                  href={`/factions/${f.id}`}
                  className="inline-flex items-center space-x-1 text-xs text-brand hover:underline font-semibold"
                >
                  <span>{t(locale, "factions.roster")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
