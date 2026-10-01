import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency, formatDate } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";

interface RepRow extends RowDataPacket {
  contact: string;
  reputation: number;
  missions_completed: number;
}

interface HistoryRow extends RowDataPacket {
  id: number;
  mission: string;
  started_at: number;
  completed_at: number | null;
  result: string;
  reward: number;
}

export default async function MyMissionsPage() {
  const session = await getCurrentSession();
  if (!session || !session.selectedCharacterId) {
    redirect("/login");
  }

  const locale = await getViewerLocale();

  const [reputation, history] = await Promise.all([
    dbQuery<RepRow>(
      `SELECT contact, reputation, missions_completed
       FROM sunset_mission_reputation
       WHERE character_id = ?
       ORDER BY reputation DESC`,
      [session.selectedCharacterId]
    ),
    dbQuery<HistoryRow>(
      `SELECT id, mission, started_at, completed_at, result, reward
       FROM sunset_mission_history
       WHERE character_id = ?
       ORDER BY id DESC
       LIMIT 20`,
      [session.selectedCharacterId]
    ),
  ]);

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {t(locale, "nav.missions")}
        </h1>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {reputation.length > 0 ? (
          reputation.map((rep) => (
            <div
              key={rep.contact}
              className="p-3.5 bg-surface-100 border border-surface-border rounded flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#f1f1f1] capitalize">
                    {rep.contact}
                  </span>
                  <span className="font-mono text-[#a5a5a8]">
                    {rep.reputation} Rep
                  </span>
                </div>
                <p className="text-xs text-[#6f6f74] mt-1">
                  {rep.missions_completed} completed
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-[#6f6f74] p-4 border border-surface-border rounded bg-surface-100 col-span-3 text-center">
            No mission contacts yet.
          </p>
        )}
      </div>

      {/* History Table */}
      {history.length > 0 && (
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border text-xs font-semibold text-[#f1f1f1]">
            History
          </div>

          <div className="responsive-table-wrapper">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                <tr>
                  <th className="py-2 px-3">Mission</th>
                  <th className="py-2 px-3">Result</th>
                  <th className="py-2 px-3">Reward</th>
                  <th className="py-2 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                {history.map((h) => {
                  const isSuccess = h.result === "completed" || h.result === "success";
                  return (
                    <tr key={h.id}>
                      <td className="py-2 px-3 font-medium text-[#f1f1f1] capitalize">
                        {h.mission.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`font-medium ${isSuccess ? "text-emerald-400" : "text-red-400"}`}>
                          {h.result}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[#f1f1f1]">
                        {formatCurrency(h.reward)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-[#6f6f74]">
                        {formatDate(h.started_at * 1000, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
