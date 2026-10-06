"use client";

import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PublicVehicleCardData } from "@/lib/vehicle-profile";
import { PlayerVehicleCard } from "./PlayerVehicleCard";

export function PlayerVehiclesSection({
  locale,
  vehicles,
}: {
  locale: Locale;
  vehicles: PublicVehicleCardData[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
          {t(locale, "interface.vehicles_2")} ({vehicles.length})
        </h2>
      </div>

      {vehicles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {vehicles.map((v) => (
            <PlayerVehicleCard key={v.id} locale={locale} vehicle={v} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#8F8B83] p-4 rounded-xl bg-[#0E0E10]">
          {t(locale, "interface.no_vehicles_registered")}
        </p>
      )}
    </div>
  );
}
