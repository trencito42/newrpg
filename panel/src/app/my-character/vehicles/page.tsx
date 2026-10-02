import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { GTAImage } from "@/components/ui/GTAImage";
import { getVehiclePreviewUrl } from "@/lib/gta-assets";
import { vehicleDisplayName } from "@/lib/vehicle-names";

interface VehicleRow extends RowDataPacket {
  id: number;
  plate: string;
  model: string;
  catalog_label: string | null;
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
  preview_url: string | null;
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
            vm.preview_url, dv.label AS catalog_label,
            iv.id AS impound_id, iv.reason AS impound_reason,
            iv.fee AS impound_fee, iv.status AS impound_status
     FROM vehicles v
     LEFT JOIN panel_vehicle_media vm ON vm.vehicle_id = v.id
     LEFT JOIN dealership_vehicles dv ON LOWER(dv.model) = LOWER(v.model)
     LEFT JOIN impounded_vehicles iv ON iv.vehicle_id = v.id AND iv.status = 'impounded'
     WHERE v.character_id = ?
     ORDER BY v.id DESC`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "nav.vehicles")}
          </h1>
        </div>

        <span className="font-mono text-xs text-[#B4AFA4] bg-surface-100 border border-surface-border px-2.5 py-1 rounded w-fit">
          {vehicles.length} vehicles
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {vehicles.length > 0 ? (
          vehicles.map((veh) => {
            const isImpounded = veh.impound_status === "impounded";
            return (
              <div
                key={veh.id}
                className="p-3.5 bg-surface-100 border border-surface-border rounded flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[#F2EFE8]">
                      {veh.plate}
                    </span>
                    {isImpounded ? (
                      <span className="text-amber-400 font-medium">Impounded</span>
                    ) : veh.destroyed ? (
                      <span className="text-red-400 font-medium">Destroyed</span>
                    ) : veh.stored ? (
                      <span className="text-[#8F8B83]">Garage</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">Active</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="w-16 h-12 bg-[#191719] rounded overflow-hidden shrink-0 border border-surface-border flex items-center justify-center">
                      <GTAImage
                        src={getVehiclePreviewUrl(veh.model, veh.preview_url)}
                        alt={vehicleDisplayName(veh.model, veh.catalog_label)}
                        fallbackText="GTA V"
                        className="w-full h-full object-contain p-0.5"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[#F2EFE8] truncate">
                        {vehicleDisplayName(veh.model, veh.catalog_label)}
                      </h3>
                      <p className="text-xs text-[#99958E] mt-0.5 truncate">
                        Garage: <span className="text-[#B4AFA4] capitalize">{veh.garage || "default"}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-surface-border/60 grid grid-cols-3 gap-2 text-center text-xs text-[#8F8B83]">
                  <div>
                    <span className="block text-[10px]">Fuel</span>
                    <span className="font-mono text-[#F2EFE8]">{veh.fuel}%</span>
                  </div>
                  <div>
                    <span className="block text-[10px]">Engine</span>
                    <span className="font-mono text-[#F2EFE8]">{Math.round(veh.engine / 10)}%</span>
                  </div>
                  <div>
                    <span className="block text-[10px]">Body</span>
                    <span className="font-mono text-[#F2EFE8]">{Math.round(veh.body / 10)}%</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-[#8F8B83] p-4 border border-surface-border rounded bg-surface-100 col-span-3 text-center">
            No vehicles found.
          </p>
        )}
      </div>
    </div>
  );
}
