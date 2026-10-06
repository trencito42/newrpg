"use client";

import { GTAImage } from "@/components/ui/GTAImage";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PublicVehicleCardData } from "@/lib/vehicle-profile";
import { VehicleProfileTrigger } from "./VehicleProfileTrigger";

export function PlayerVehicleCard({
  locale,
  vehicle,
}: {
  locale: Locale;
  vehicle: PublicVehicleCardData;
}) {
  return (
    <VehicleProfileTrigger locale={locale} vehicle={vehicle}>
      <div className="p-3 bg-[#0E0E10] rounded-xl flex gap-3 items-center hover:bg-[#121214] transition-colors">
        <div className="w-14 h-11 bg-[#141416] rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
          <GTAImage
            src={vehicle.previewUrl}
            alt={vehicle.displayName}
            fallbackText="GTA V"
            className="w-full h-full object-contain p-0.5"
          />
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-[#F2EFE8] truncate">{vehicle.displayName}</span>
            {vehicle.destroyed ? (
              <span className="text-[10px] text-red-400 font-mono shrink-0">{t(locale, "interface.destroyed")}</span>
            ) : vehicle.stored ? (
              <span className="text-[10px] text-[#8F8B83] font-mono shrink-0">{t(locale, "interface.garage")}</span>
            ) : (
              <span className="text-[10px] text-emerald-400 font-mono shrink-0">{t(locale, "common.active")}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#99958E] mt-0.5 font-mono">
            <span>{vehicle.plate}</span>
            <span>•</span>
            <span>{t(locale, "interface.insurance_level")} {vehicle.insuranceLevel || 1}</span>
          </div>
        </div>
      </div>
    </VehicleProfileTrigger>
  );
}
