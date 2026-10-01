import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency, formatNumber } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Briefcase, Award, TrendingUp, DollarSign } from "lucide-react";
import { RowDataPacket } from "mysql2";

interface JobSkillRow extends RowDataPacket {
  job_id: string;
  level: number;
  xp: number;
  completed_tasks: number;
  total_earned: number;
  updated_at: string;
}

const CIVILIAN_JOB_NAMES: Record<string, string> = {
  trucker: "Heavy Cargo Trucker",
  garbage: "Municipal Sanitation Collector",
  courier: "Fast Urban Courier",
  fisherman: "Deep Sea Fisherman",
  mechanic: "Roadside Fleet Mechanic",
  hunter: "Wildlife Contract Hunter",
  diver: "Marine Salvage Diver",
  lockpicking: "Lockpicking & Intrusion",
};

export default async function MyJobsPage() {
  const session = await getCurrentSession();
  if (!session || !session.selectedCharacterId) {
    redirect("/login");
  }

  const locale = await getViewerLocale();

  const skills = await dbQuery<JobSkillRow>(
    `SELECT job_id, level, xp, completed_tasks, total_earned, updated_at
     FROM job_progress
     WHERE character_id = ?
     ORDER BY level DESC, completed_tasks DESC`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Career Progress & Job Skills
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Detailed skill tiers, completed job tasks, and lifetime career earnings for {session.selectedCharacterName}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.length > 0 ? (
          skills.map((skill) => {
            const title = CIVILIAN_JOB_NAMES[skill.job_id] || skill.job_id;
            return (
              <Card key={skill.job_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="brand" className="font-mono">
                      Tier Level {skill.level}
                    </Badge>
                    <span className="font-mono text-xs text-emerald-400 font-bold">
                      Earned {formatCurrency(skill.total_earned)}
                    </span>
                  </div>
                  <CardTitle className="text-base mt-2 capitalize">{title}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                    <span className="text-gray-400">Experience Points (XP)</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatNumber(skill.xp, locale)} XP
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                    <span className="text-gray-400">Completed Deliveries / Tasks</span>
                    <span className="font-mono text-gray-200">
                      {formatNumber(skill.completed_tasks, locale)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-gray-500 font-mono text-[11px]">
                    <span>Skill ID</span>
                    <span className="capitalize">{skill.job_id}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full p-8 text-center text-gray-500 text-xs">
            <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p>You have not completed any civilian job shifts yet. Visit the Job Center in-game.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
