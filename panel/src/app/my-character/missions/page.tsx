import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Target, Award, CheckCircle2, XCircle } from "lucide-react";
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

  const reputation = await dbQuery<RepRow>(
    `SELECT contact, reputation, missions_completed
     FROM sunset_mission_reputation
     WHERE character_id = ?
     ORDER BY reputation DESC`,
    [session.selectedCharacterId]
  );

  const history = await dbQuery<HistoryRow>(
    `SELECT id, mission, started_at, completed_at, result, reward
     FROM sunset_mission_history
     WHERE character_id = ?
     ORDER BY id DESC
     LIMIT 20`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Contracts & Mission History
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Underworld and corporate contract reputation for {session.selectedCharacterName}.
        </p>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reputation.length > 0 ? (
          reputation.map((rep) => (
            <Card key={rep.contact}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="brand">Contractor</Badge>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {rep.reputation} Rep
                  </span>
                </div>
                <CardTitle className="text-base mt-2 capitalize">{rep.contact}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-400">
                <p>{rep.missions_completed} Completed Contracts</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full p-6 text-center text-gray-500 text-xs">
            <Target className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p>No contract missions accepted yet. Explore mission contacts in-game.</p>
          </Card>
        )}
      </div>

      {/* History Table */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Mission Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="responsive-table-wrapper">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border">
                  <tr>
                    <th className="pb-2">Mission</th>
                    <th className="pb-2">Result</th>
                    <th className="pb-2">Bounty / Reward</th>
                    <th className="pb-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50 text-gray-300">
                  {history.map((h) => {
                    const isSuccess = h.result === "completed" || h.result === "success";
                    return (
                      <tr key={h.id}>
                        <td className="py-2.5 font-medium text-white capitalize">
                          {h.mission.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5">
                          <Badge variant={isSuccess ? "success" : "danger"}>
                            {h.result.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2.5 font-mono text-emerald-400 font-semibold">
                          {formatCurrency(h.reward)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-gray-500">
                          {formatDate(h.started_at * 1000, locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
