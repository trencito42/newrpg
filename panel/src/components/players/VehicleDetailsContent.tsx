"use client";

import { GTAImage } from "@/components/ui/GTAImage";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PublicVehicleCardData, VehicleModLevel } from "@/lib/vehicle-profile";

function ColorSwatch({ rgb }: { rgb: { r: number; g: number; b: number } }) {
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-sm border border-white/15 shrink-0"
      style={{ backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}
      aria-hidden
    />
  );
}

function modLabel(locale: Locale, mod: VehicleModLevel): string {
  if (mod === "stock") return t(locale, "players.vehicle_stock");
  return t(locale, "players.vehicle_mod_level", { level: mod.level, max: mod.max });
}

export function VehicleDetailsContent({
  locale,
  vehicle,
  large = false,
}: {
  locale: Locale;
  vehicle: PublicVehicleCardData;
  large?: boolean;
}) {
  const d = vehicle.details;
  const statusLabel = vehicle.destroyed
    ? t(locale, "interface.destroyed")
    : vehicle.stored
      ? t(locale, "interface.garage")
      : t(locale, "common.active");

  const showPerf =
    !d.performance.allStock
    || !d.ecu.stock;

  return (
    <div className="space-y-3 text-xs text-[#B4AFA4]">
      <div className={`${large ? "h-36" : "h-28"} rounded-lg bg-[#141416] overflow-hidden flex items-center justify-center`}>
        <GTAImage
          src={vehicle.previewUrl}
          alt={vehicle.displayName}
          fallbackText="GTA V"
          className="w-full h-full object-contain p-2"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-[#F2EFE8] text-sm truncate">{vehicle.displayName}</p>
            <p className="font-mono text-[10px] text-[#8F8B83] truncate">{vehicle.model}</p>
          </div>
          {vehicle.addonThumbnail && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#D7B558] border border-[#D7B558]/30 px-1.5 py-0.5 rounded">
              {t(locale, "players.vehicle_custom_badge")}
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-[#99958E]">{vehicle.plate}</p>
        <p className="text-[11px]">
          <span className="text-[#8F8B83]">{t(locale, "common.status")}:</span>{" "}
          <span className="text-[#F2EFE8]">{statusLabel}</span>
          <span className="text-[#8F8B83] mx-1">·</span>
          <span className="text-[#8F8B83]">{t(locale, "interface.insurance_level")}</span>{" "}
          <span className="text-[#F2EFE8]">{vehicle.insuranceLevel || 1}</span>
        </p>
      </div>

      {d.colors.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#8F8B83] font-semibold mb-1.5">
            {t(locale, "players.vehicle_colors")}
          </p>
          <ul className="space-y-1">
            {d.colors.map((c) => (
              <li key={c.role} className="flex items-center gap-2">
                {c.kind === "rgb" ? <ColorSwatch rgb={c.rgb} /> : (
                  <span className="w-3.5 h-3.5 rounded-sm border border-white/15 bg-[#1a1a1c] shrink-0" />
                )}
                <span className="text-[#F2EFE8] min-w-[4.5rem]">
                  {c.role === "primary"
                    ? t(locale, "players.vehicle_primary")
                    : t(locale, "players.vehicle_secondary")}
                </span>
                {c.kind === "rgb" ? (
                  <span className="font-mono text-[10px] text-[#99958E]">
                    {t(locale, "players.vehicle_rgb_values", {
                      r: c.rgb.r,
                      g: c.rgb.g,
                      b: c.rgb.b,
                      hex: c.hex,
                    })}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-[#99958E]">
                    {t(locale, "players.vehicle_gta_color", { index: c.gtaIndex })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {d.pearlescentIndex != null && (
            <p className="mt-1 text-[10px] text-[#8F8B83]">
              {t(locale, "players.vehicle_pearlescent")} #{d.pearlescentIndex}
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#8F8B83] font-semibold mb-1.5">
          {t(locale, "players.vehicle_performance")}
        </p>
        {d.performance.allStock && d.ecu.stock ? (
          <p className="text-[11px] text-[#8F8B83]">{t(locale, "players.vehicle_stock_performance")}</p>
        ) : (
          <ul className="space-y-0.5 font-mono text-[11px]">
            {!isStockMod(d.performance.engine) && (
              <li className="flex justify-between gap-2">
                <span>{t(locale, "players.vehicle_engine")}</span>
                <span className="text-[#F2EFE8]">{modLabel(locale, d.performance.engine)}</span>
              </li>
            )}
            {!isStockMod(d.performance.brakes) && (
              <li className="flex justify-between gap-2">
                <span>{t(locale, "players.vehicle_brakes")}</span>
                <span className="text-[#F2EFE8]">{modLabel(locale, d.performance.brakes)}</span>
              </li>
            )}
            {!isStockMod(d.performance.transmission) && (
              <li className="flex justify-between gap-2">
                <span>{t(locale, "players.vehicle_transmission")}</span>
                <span className="text-[#F2EFE8]">{modLabel(locale, d.performance.transmission)}</span>
              </li>
            )}
            {!isStockMod(d.performance.suspension) && (
              <li className="flex justify-between gap-2">
                <span>{t(locale, "players.vehicle_suspension")}</span>
                <span className="text-[#F2EFE8]">{modLabel(locale, d.performance.suspension)}</span>
              </li>
            )}
            {d.performance.turbo && (
              <li className="flex justify-between gap-2">
                <span>{t(locale, "players.vehicle_turbo")}</span>
                <span className="text-[#F2EFE8]">{t(locale, "players.vehicle_installed")}</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {showPerf && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#8F8B83] font-semibold mb-1.5">
            {t(locale, "players.vehicle_ecu")}
          </p>
          {d.ecu.stock ? (
            <p className="text-[11px]">{t(locale, "players.vehicle_ecu_stock")}</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[#F2EFE8] text-[11px]">
                {d.ecu.stageKey && d.ecu.exhaustKey
                  ? `${t(locale, d.ecu.stageKey)} · ${t(locale, d.ecu.exhaustKey)}`
                  : t(locale, "players.vehicle_tuned")}
              </p>
              {d.ecu.dynoHp != null && d.ecu.dynoHp > 0 && (
                <p className="font-mono text-[10px] text-[#99958E]">
                  {t(locale, "players.vehicle_dyno", {
                    hp: d.ecu.dynoHp,
                    torque: d.ecu.dynoTorque ?? 0,
                  })}
                </p>
              )}
              {d.ecu.chips.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {d.ecu.chips.map((chip) => (
                    <span
                      key={chip}
                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#141416] text-[#D7B558] border border-white/[0.06]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {d.cosmetics.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#8F8B83] font-semibold mb-1.5">
            {t(locale, "players.vehicle_cosmetics")}
          </p>
          <ul className="space-y-0.5 text-[11px]">
            {d.cosmetics.map((line) => (
              <li key={line.labelKey} className="flex justify-between gap-2">
                <span>{t(locale, line.labelKey)}</span>
                <span className="text-[#F2EFE8] text-right truncate max-w-[55%]">
                  {line.valueKey
                    ? t(locale, line.valueKey, line.valueParams)
                    : line.value?.startsWith("players.")
                      ? t(locale, line.value)
                      : line.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function isStockMod(mod: VehicleModLevel): boolean {
  return mod === "stock";
}
