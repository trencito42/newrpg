import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency, formatNumber } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";

interface JobSkillRow extends RowDataPacket {
  job_id: string;
  level: number;
  xp: number;
  completed_tasks: number;
  total_earned: number;
  updated_at: string;
}

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
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "nav.jobs")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {skills.length > 0 ? (
          skills.map((skill) => (
            <div
              key={skill.job_id}
              className="p-3.5 bg-surface-100 border border-surface-border rounded flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#F2EFE8] font-semibold">
                    {t(locale, "common.level")} {skill.level}
                  </span>
                  <span className="font-mono text-[#F2EFE8]">
                    {formatCurrency(skill.total_earned)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#F2EFE8] mt-1 capitalize">
                  {skill.job_id.replace(/_/g, " ")}
                </h3>
              </div>

              <div className="mt-3 pt-2 border-t border-surface-border/60 text-xs space-y-1 text-[#8F8B83]">
                <div className="flex items-center justify-between">
                  <span>{t(locale, "interface.experience")}</span>
                  <span className="font-mono text-[#B4AFA4]">{formatNumber(skill.xp, locale)} XP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t(locale, "interface.tasks")}</span>
                  <span className="font-mono text-[#B4AFA4]">{formatNumber(skill.completed_tasks, locale)}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-[#8F8B83] p-4 border border-surface-border rounded bg-surface-100 col-span-2 text-center">
            {t(locale, "interface.no_job_progress_yet")}</p>
        )}
      </div>
    </div>
  );
}
