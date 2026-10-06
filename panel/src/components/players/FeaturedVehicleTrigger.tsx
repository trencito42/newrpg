"use client";

import { GTAImage } from "@/components/ui/GTAImage";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PublicVehicleCardData } from "@/lib/vehicle-profile";
import { VehicleProfileTrigger } from "./VehicleProfileTrigger";

export function FeaturedVehicleTrigger({
  locale,
  vehicle,
}: {
  locale: Locale;
  vehicle: PublicVehicleCardData;
}) {
  return (
    <VehicleProfileTrigger locale={locale} vehicle={vehicle} className="lg:max-w-xs w-full">
      <div className="flex items-center gap-3 p-3 bg-[#121214] rounded-xl hover:bg-[#141416] transition-colors">
        <div className="w-16 h-12 bg-[#18181B] rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
          <GTAImage
            src={vehicle.previewUrl}
            alt={vehicle.displayName}
            fallbackText="GTA V"
            className="w-full h-full object-contain p-1"
          />
        </div>
        <div className="min-w-0 text-xs">
          <span className="text-[10px] text-[#8F8B83] uppercase tracking-wider block font-semibold">
            {t(locale, "interface.featured_vehicle")}
          </span>
          <span className="font-bold text-[#F2EFE8] truncate block">{vehicle.displayName}</span>
          <span className="font-mono text-[11px] text-[#99958E] block">{vehicle.plate}</span>
        </div>
      </div>
    </VehicleProfileTrigger>
  );
}
