import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatDate, formatCurrency } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Car, Fuel, Wrench, Shield, AlertTriangle } from "lucide-react";
import { RowDataPacket } from "mysql2";

interface VehicleRow extends RowDataPacket {
  id: number;
  plate: string;
  model: string;
  fuel: number;
  engine: number;
  body: number;
  stored: boolean;
  garage: string;
  insurance_points: number;
  insurance_level: number;
  destroyed: boolean;
  insurance_cost: number;
  created_at: string;
  impound_id: number | null;
  impound_reason: string | null;
  impound_fee: number | null;
  impound_status: string | null;
}

export default async function MyVehiclesPage() {
  const session = await getCurrentSession();
  if (!session || !session.selectedCharacterId) {
    redirect("/login");
  }

  const locale = await getViewerLocale();

  const vehicles = await dbQuery<VehicleRow>(
    `SELECT v.*,
            iv.id AS impound_id, iv.reason AS impound_reason,
            iv.fee AS impound_fee, iv.status AS impound_status
     FROM vehicles v
     LEFT JOIN impounded_vehicles iv ON iv.vehicle_id = v.id AND iv.status = 'impounded'
     WHERE v.character_id = ?
     ORDER BY v.id DESC`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Personal Fleet & Garage
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Registered vehicles belonging to {session.selectedCharacterName}.
          </p>
        </div>

        <span className="font-mono text-xs text-gray-400 bg-surface-100 border border-surface-border px-3 py-1.5 rounded-lg w-fit">
          {vehicles.length} Vehicles Registered
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.length > 0 ? (
          vehicles.map((veh) => {
            const isImpounded = veh.impound_status === "impounded";
            return (
              <Card
                key={veh.id}
                className={`flex flex-col justify-between ${
                  isImpounded ? "border-amber-500/30 bg-amber-500/5" : ""
                }`}
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm px-2 py-0.5 rounded bg-surface-border text-white tracking-wider border border-surface-borderLight">
                        {veh.plate}
                      </span>
                      {isImpounded ? (
                        <Badge variant="warning">Impounded</Badge>
                      ) : veh.stored ? (
                        <Badge variant="default">In Garage</Badge>
                      ) : (
                        <Badge variant="success">Parked / Active</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg mt-2 capitalize font-mono">
                      {veh.model}
                    </CardTitle>
                    <p className="text-xs text-gray-400">
                      Garage location: <span className="text-gray-200 capitalize">{veh.garage || "legion"}</span>
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-2 text-xs">
                    {/* Fuel & Health */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-surface-100 rounded-lg border border-surface-border">
                        <div className="flex items-center space-x-1 text-gray-400 mb-0.5">
                          <Fuel className="w-3.5 h-3.5 text-amber-400" />
                          <span>Fuel</span>
                        </div>
                        <span className="font-mono font-bold text-white">
                          {Math.round(veh.fuel)}%
                        </span>
                      </div>

                      <div className="p-2 bg-surface-100 rounded-lg border border-surface-border">
                        <div className="flex items-center space-x-1 text-gray-400 mb-0.5">
                          <Wrench className="w-3.5 h-3.5 text-sky-400" />
                          <span>Engine</span>
                        </div>
                        <span className="font-mono font-bold text-white">
                          {Math.round(veh.engine / 10)}%
                        </span>
                      </div>
                    </div>

                    {/* Insurance points */}
                    <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                      <span className="text-gray-400 flex items-center space-x-1">
                        <Shield className="w-3.5 h-3.5 text-brand" />
                        <span>Insurance Points</span>
                      </span>
                      <span className="font-mono font-bold text-amber-400">
                        {veh.insurance_points} pts
                      </span>
                    </div>

                    {/* Impound Warning banner */}
                    {isImpounded && (
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-0.5">
                        <div className="font-semibold flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Impounded by Police</span>
                        </div>
                        <p className="text-gray-400">Reason: {veh.impound_reason}</p>
                        <p className="font-mono text-white">
                          Release Fee: {formatCurrency(veh.impound_fee || 500)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="pt-3 mt-2 border-t border-surface-border/60 text-[11px] text-gray-500 font-mono flex justify-between">
                  <span>Registered:</span>
                  <span>{formatDate(veh.created_at, locale, false)}</span>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full p-8 text-center text-gray-500 text-xs">
            <Car className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p>You do not own any vehicles yet. Visit the dealership in-game.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
