import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Shield, Users, User, ArrowLeft, AlertCircle, Car } from "lucide-react";
import { RowDataPacket } from "mysql2";

const FACTIONS_CATALOG: Record<
  string,
  {
    label: string;
    type: "legal" | "illegal";
    category: string;
    description: string;
    society: string;
    fleet: Array<{ model: string; label: string; minGrade: number }>;
  }
> = {
  police: {
    label: "LSPD",
    type: "legal",
    category: "Law Enforcement",
    description: "Los Santos Police Department — city patrol, emergency response, citations, and felony arrests.",
    society: "police",
    fleet: [
      { model: "police", label: "Patrol Cruiser", minGrade: 0 },
      { model: "police2", label: "Buffalo Patrol", minGrade: 1 },
      { model: "police3", label: "Interceptor", minGrade: 2 },
      { model: "policeb", label: "Police Bike", minGrade: 2 },
      { model: "policet", label: "Transport Van", minGrade: 3 },
      { model: "police4", label: "Unmarked Cruiser", minGrade: 4 },
      { model: "riot", label: "SWAT Bearcat", minGrade: 5 },
      { model: "polmav", label: "Air Support", minGrade: 6 },
    ],
  },
  sheriff: {
    label: "San Andreas Sheriff",
    type: "legal",
    category: "Law Enforcement",
    description: "County sheriff department — rural patrol, robbery containment, warrants, and high-speed pursuits.",
    society: "sheriff",
    fleet: [
      { model: "sheriff", label: "Sheriff Cruiser", minGrade: 0 },
      { model: "sheriff2", label: "Sheriff SUV", minGrade: 1 },
      { model: "police3", label: "County Interceptor", minGrade: 2 },
      { model: "policeb", label: "Police Bike", minGrade: 3 },
      { model: "police4", label: "Unmarked Unit", minGrade: 4 },
      { model: "riot", label: "Tactical Response", minGrade: 5 },
    ],
  },
  fib: {
    label: "Federal Investigation Bureau",
    type: "legal",
    category: "Federal Intelligence",
    description: "Federal Bureau — intelligence gathering, anti-corruption, major drug trafficking, and tactical raids.",
    society: "fib",
    fleet: [
      { model: "fbi", label: "FIB Sedan", minGrade: 0 },
      { model: "fbi2", label: "FIB SUV", minGrade: 1 },
      { model: "police4", label: "Unmarked Cruiser", minGrade: 3 },
      { model: "baller6", label: "Armored SUV", minGrade: 4 },
      { model: "schafter5", label: "Executive Sedan", minGrade: 5 },
      { model: "polmav", label: "FIB Air Unit", minGrade: 6 },
    ],
  },
  medic: {
    label: "Pillbox EMS",
    type: "legal",
    category: "Medical Rescue",
    description: "Emergency medical services — trauma response, patient stabilization, field triage, and citywide revivals.",
    society: "medic",
    fleet: [
      { model: "ambulance", label: "Ambulance", minGrade: 0 },
      { model: "lguard", label: "Lifeguard SUV", minGrade: 3 },
      { model: "rumpo", label: "EMS Response Van", minGrade: 4 },
      { model: "polmav", label: "Air Ambulance", minGrade: 7 },
    ],
  },
  lsfd: {
    label: "LS Fire Department",
    type: "legal",
    category: "Fire Rescue",
    description: "Fire and rescue — heavy vehicle extraction, chemical spills, structure fires, and paramedic backup.",
    society: "lsfd",
    fleet: [
      { model: "firetruk", label: "Fire Engine", minGrade: 0 },
      { model: "ambulance", label: "Rescue Ambulance", minGrade: 2 },
      { model: "lguard", label: "Brush Patrol", minGrade: 3 },
      { model: "rumpo", label: "Crew Van", minGrade: 4 },
    ],
  },
  taxi: {
    label: "Downtown Cab Co.",
    type: "legal",
    category: "Public Transit",
    description: "City taxi service — passenger transportation across San Andreas via phone dispatch.",
    society: "taxi",
    fleet: [
      { model: "taxi", label: "Yellow Cab", minGrade: 0 },
      { model: "dynasty", label: "Executive Sedan", minGrade: 2 },
      { model: "stretch", label: "Limousine", minGrade: 5 },
    ],
  },
  mechanic: {
    label: "LS Customs",
    type: "legal",
    category: "Automotive Service",
    description: "Licensed vehicle workshop — roadside repairs, engine overhauls, tow services, and ECU tuning.",
    society: "mechanic",
    fleet: [
      { model: "towtruck", label: "Tow Truck", minGrade: 0 },
      { model: "flatbed", label: "Flatbed", minGrade: 3 },
      { model: "slamtruck", label: "Recovery Rig", minGrade: 6 },
    ],
  },
  lssi: {
    label: "LSSI — License & Safety",
    type: "legal",
    category: "Education & Licensing",
    description: "Safety Institute — certified pilot exams, boat licenses, and firearm certification tests.",
    society: "lssi",
    fleet: [
      { model: "asea", label: "Instructor Sedan", minGrade: 0 },
      { model: "speedo", label: "Training Equipment Van", minGrade: 1 },
      { model: "seminole", label: "Field Training SUV", minGrade: 2 },
    ],
  },
  sunset_cartel: {
    label: "Sunset Cartel",
    type: "illegal",
    category: "Criminal Syndicate",
    description: "Organized narcotic syndicate — lab synthesis, distribution routes, smuggling, and turf dominance.",
    society: "sunset_cartel",
    fleet: [
      { model: "baller2", label: "Cartel SUV", minGrade: 0 },
      { model: "dubsta2", label: "Armored SUV", minGrade: 2 },
      { model: "cavalcade2", label: "Executive SUV", minGrade: 4 },
      { model: "insurgent2", label: "Convoy Truck", minGrade: 6 },
    ],
  },
  night_syndicate: {
    label: "Night Syndicate",
    type: "illegal",
    category: "Underground Network",
    description: "Underground street syndicate — weapons fabrication, illegal fencing, vehicle chop, and contract operations.",
    society: "night_syndicate",
    fleet: [
      { model: "stanier", label: "Street Sedan", minGrade: 0 },
      { model: "kuruma", label: "Armored Kuruma", minGrade: 2 },
      { model: "fugitive", label: "Pursuit Sedan", minGrade: 4 },
      { model: "banshee", label: "Fastback", minGrade: 5 },
    ],
  },
};

interface MemberRow extends RowDataPacket {
  id: number;
  firstname: string;
  lastname: string;
  job_grade: number;
  level: number;
  joined_at: string | null;
  last_played: string | null;
}

interface LeaderRow extends RowDataPacket {
  leader_name: string;
  character_id: number;
  assigned_at: string;
}

interface WarningRow extends RowDataPacket {
  id: number;
  character_id: number;
  character_name: string;
  reason: string;
  created_at: string;
}

export default async function FactionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const faction = FACTIONS_CATALOG[slug];
  if (!faction) {
    notFound();
  }

  const locale = await getViewerLocale();

  // Load roster members
  const members = await dbQuery<MemberRow>(
    `SELECT c.id, c.firstname, c.lastname, c.job_grade, c.level, c.last_played,
            fm.joined_at
     FROM characters c
     LEFT JOIN faction_membership fm ON fm.character_id = c.id
     WHERE c.job = ?
     ORDER BY c.job_grade DESC, c.level DESC, c.id ASC`,
    [slug]
  );

  // Load leadership
  const leader = await dbQuerySingle<LeaderRow>(
    `SELECT fl.character_id, fl.assigned_at, CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS leader_name
     FROM faction_leaders fl
     JOIN characters c ON c.id = fl.character_id
     WHERE fl.faction_id = ?
     LIMIT 1`,
    [slug]
  );

  // Load active warnings
  const warnings = await dbQuery<WarningRow>(
    `SELECT fw.id, fw.character_id, fw.reason, fw.created_at,
            CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS character_name
     FROM faction_warnings fw
     JOIN characters c ON c.id = fw.character_id
     WHERE fw.faction_id = ?
     ORDER BY fw.id DESC
     LIMIT 5`,
    [slug]
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb navigation */}
      <div>
        <Link
          href="/factions"
          className="inline-flex items-center space-x-1.5 text-xs text-gray-400 hover:text-brand transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Factions</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-black text-white tracking-tight">
                {faction.label}
              </h1>
              <Badge variant={faction.type === "legal" ? "success" : "danger"}>
                {faction.type === "legal" ? "Legal Organization" : "Criminal Syndicate"}
              </Badge>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
              {faction.description}
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-mono text-gray-400 bg-surface-100 border border-surface-border px-3 py-1.5 rounded-lg">
              {members.length} Active Members
            </span>
          </div>
        </div>
      </div>

      {/* Leadership & Warnings Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Leadership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {leader ? (
              <div className="p-3 bg-surface-100 rounded-lg border border-surface-border">
                <span className="text-gray-400 block mb-1">Current Leader</span>
                <Link
                  href={`/players/${leader.character_id}`}
                  className="text-base font-bold text-brand hover:underline block"
                >
                  {leader.leader_name}
                </Link>
                <span className="text-[10px] text-gray-500 font-mono block mt-1">
                  Appointed: {formatDate(leader.assigned_at, locale, false)}
                </span>
              </div>
            ) : (
              <p className="text-gray-500 text-xs py-2">
                Leadership is currently vacant. Inquire on Discord.
              </p>
            )}

            <div className="pt-2">
              <span className="text-gray-400 font-medium block mb-1">
                Authorized Fleet
              </span>
              <div className="space-y-1">
                {faction.fleet.slice(0, 4).map((car) => (
                  <div
                    key={car.model}
                    className="flex items-center justify-between py-1 border-b border-surface-border/50 text-[11px]"
                  >
                    <span className="text-gray-200">{car.label}</span>
                    <span className="text-gray-500 font-mono">Rank {car.minGrade}+</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Member Roster */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Official Roster</CardTitle>
              <span className="text-xs text-gray-400 font-mono">
                {members.length} Personnel
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="responsive-table-wrapper">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border">
                  <tr>
                    <th className="pb-2.5">Member</th>
                    <th className="pb-2.5">Rank Grade</th>
                    <th className="pb-2.5">Level</th>
                    <th className="pb-2.5 text-right">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50 text-gray-300">
                  {members.length > 0 ? (
                    members.map((m) => {
                      const name = `${m.firstname} ${m.lastname || ""}`.trim();
                      return (
                        <tr key={m.id} className="hover:bg-surface-100/50">
                          <td className="py-2.5">
                            <Link
                              href={`/players/${m.id}`}
                              className="font-bold text-white hover:text-brand transition-colors"
                            >
                              {name}
                            </Link>
                          </td>
                          <td className="py-2.5 font-mono text-amber-400 font-semibold">
                            Grade {m.job_grade}
                          </td>
                          <td className="py-2.5 font-mono text-gray-400">
                            Lvl {m.level}
                          </td>
                          <td className="py-2.5 text-right font-mono text-gray-500">
                            {m.joined_at ? formatDate(m.joined_at, locale, false) : "Legacy"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-500">
                        No members currently enrolled in this faction.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
