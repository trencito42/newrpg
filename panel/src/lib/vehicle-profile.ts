/**
 * Public vehicle profile DTO — mirrors sunset_vehicles + sunset_tuning persisted props.
 * Do not expose raw JSON on the panel.
 */

export type Rgb = { r: number; g: number; b: number };

export type VehicleColorDisplay =
  | { kind: "rgb"; role: "primary" | "secondary"; rgb: Rgb; hex: string }
  | { kind: "gta"; role: "primary" | "secondary"; gtaIndex: number };

export type VehicleModLevel = "stock" | { level: number; max: number };

export type VehicleProfileDetails = {
  colors: VehicleColorDisplay[];
  pearlescentIndex?: number;
  wheelColorIndex?: number;
  paintFinish?: { id: number; labelKey: string };
  performance: {
    engine: VehicleModLevel;
    brakes: VehicleModLevel;
    transmission: VehicleModLevel;
    suspension: VehicleModLevel;
    turbo: boolean;
    allStock: boolean;
  };
  ecu: {
    tuned: boolean;
    stock: boolean;
    stageKey?: string;
    exhaustKey?: string;
    chips: string[];
    dynoHp?: number;
    dynoTorque?: number;
  };
  cosmetics: Array<{ labelKey: string; value?: string; valueKey?: string; valueParams?: Record<string, string | number> }>;
};

export type PublicVehicleCardData = {
  id: number;
  model: string;
  displayName: string;
  plate: string;
  stored: boolean;
  destroyed: boolean;
  insuranceLevel: number;
  previewUrl: string;
  addonThumbnail: boolean;
  details: VehicleProfileDetails;
};

const PAINT_FINISH: Record<number, string> = {
  0: "players.vehicle_paint_gloss",
  1: "players.vehicle_paint_metallic",
  3: "players.vehicle_paint_matte",
  4: "players.vehicle_paint_metal",
  5: "players.vehicle_paint_chrome",
};

const WINDOW_TINT: Record<number, string> = {
  1: "players.vehicle_tint_pure_black",
  2: "players.vehicle_tint_dark_smoke",
  3: "players.vehicle_tint_light_smoke",
  4: "players.vehicle_tint_stock",
  5: "players.vehicle_tint_limo",
  6: "players.vehicle_tint_green",
};

const STAGE_LABEL: Record<string, string> = {
  civil: "players.vehicle_ecu_stage_civil",
  sport: "players.vehicle_ecu_stage_sport",
  race: "players.vehicle_ecu_stage_race",
};

const EXHAUST_LABEL: Record<string, string> = {
  pop_bang: "players.vehicle_ecu_exhaust_pop",
  flames: "players.vehicle_ecu_exhaust_flames",
  diesel: "players.vehicle_ecu_exhaust_diesel",
  extra: "players.vehicle_ecu_exhaust_extra",
};

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.floor(n)));
}

function rgbFromUnknown(value: unknown): Rgb | null {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) {
    return { r: clamp255(Number(value[0])), g: clamp255(Number(value[1])), b: clamp255(Number(value[2])) };
  }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if ("r" in o || "g" in o || "b" in o) {
      return {
        r: clamp255(Number(o.r) || 0),
        g: clamp255(Number(o.g) || 0),
        b: clamp255(Number(o.b) || 0),
      };
    }
  }
  return null;
}

function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function parseVehicleProps(raw: string | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

type SanitizedCosmetics = {
  primary: Rgb;
  secondary: Rgb;
  paintType: number;
  pearl: number;
  wheel: number;
  windowTint: number;
  xenon: boolean;
  xenonColor: number;
  neon: { enabled: boolean; color: Rgb };
  tyreSmoke: boolean;
  tyreSmokeColor: Rgb;
  mods: Record<string, number>;
  plateText: string;
};

function defaultCosmetics(): SanitizedCosmetics {
  return {
    primary: { r: 0, g: 0, b: 0 },
    secondary: { r: 111, g: 111, b: 111 },
    paintType: 0,
    pearl: 0,
    wheel: 0,
    windowTint: 0,
    xenon: false,
    xenonColor: 0,
    neon: { enabled: false, color: { r: 0, g: 150, b: 255 } },
    tyreSmoke: false,
    tyreSmokeColor: { r: 255, g: 255, b: 255 },
    mods: {},
    plateText: "",
  };
}

/** Mirror of SunsetTuning.SanitizeCosmetics (shared/config.lua). */
export function sanitizeCosmetics(raw: unknown): SanitizedCosmetics {
  const def = defaultCosmetics();
  if (!raw || typeof raw !== "object") return def;
  const o = raw as Record<string, unknown>;
  const rgb = (src: unknown, fallback: Rgb): Rgb => rgbFromUnknown(src) ?? fallback;
  const neonRaw = typeof o.neon === "object" && o.neon ? o.neon as Record<string, unknown> : {};
  const modsRaw = typeof o.mods === "object" && o.mods ? o.mods as Record<string, unknown> : {};
  const mods: Record<string, number> = {};
  for (const key of Object.keys(modsRaw)) {
    const v = Math.floor(Number(modsRaw[key]));
    if (!Number.isNaN(v)) mods[key] = Math.max(-1, Math.min(100, v));
  }
  let plate = String(o.plateText ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plate.length > 8) plate = plate.slice(0, 8);

  return {
    primary: rgb(o.primary, def.primary),
    secondary: rgb(o.secondary, def.secondary),
    paintType: Math.max(0, Math.min(5, Math.floor(Number(o.paintType) || 0))),
    pearl: Math.max(0, Math.floor(Number(o.pearl) || 0)),
    wheel: Math.max(0, Math.floor(Number(o.wheel) || 0)),
    windowTint: Math.max(0, Math.min(6, Math.floor(Number(o.windowTint) || 0))),
    xenon: o.xenon === true,
    xenonColor: Math.max(0, Math.floor(Number(o.xenonColor) || 0)),
    neon: {
      enabled: neonRaw.enabled === true,
      color: rgb(neonRaw.color, def.neon.color),
    },
    tyreSmoke: o.tyreSmoke === true,
    tyreSmokeColor: rgb(o.tyreSmokeColor, def.tyreSmokeColor),
    mods,
    plateText: plate,
  };
}

function gtaModLevel(value: unknown, max: number): VehicleModLevel {
  const n = Math.floor(Number(value));
  if (Number.isNaN(n) || n < 0) return "stock";
  return { level: n + 1, max };
}

function isStockMod(level: VehicleModLevel): boolean {
  return level === "stock";
}

function modTurboInstalled(value: unknown): boolean {
  return value === 1 || value === true;
}

/** Mirror of SunsetTuning.IsStockTune — public ECU display only. */
function isStockEcu(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return true;
  const o = raw as Record<string, unknown>;
  const stage = String(o.stage ?? "civil");
  if (stage !== "civil" || Number(o.power) !== 0 || Number(o.torque) !== 0) return false;
  const pop = typeof o.pop === "object" && o.pop ? o.pop as Record<string, unknown> : {};
  const antiLag = typeof o.antiLag === "object" && o.antiLag ? o.antiLag as Record<string, unknown> : {};
  const drift = typeof o.drift === "object" && o.drift ? o.drift as Record<string, unknown> : {};
  const hud = typeof o.hud === "object" && o.hud ? o.hud as Record<string, unknown> : {};
  const nitrous = typeof o.nitrous === "object" && o.nitrous ? o.nitrous as Record<string, unknown> : {};
  const flames = typeof o.flames === "object" && o.flames ? o.flames as Record<string, unknown> : {};
  const hardware = typeof o.hardware === "object" && o.hardware ? o.hardware as Record<string, unknown> : {};
  const handling = typeof o.handling === "object" && o.handling ? o.handling as Record<string, unknown> : {};
  const dyno = typeof o.dyno === "object" && o.dyno ? o.dyno as Record<string, unknown> : {};

  if (pop.enabled || antiLag.enabled || drift.enabled || hud.enabled) return false;
  if (nitrous.installed) return false;
  if (flames.enabled) return false;
  if (Number(dyno.lastHp) > 0) return false;
  for (const key of ["engine", "brakes", "transmission", "suspension", "armor"]) {
    if (Number(hardware[key]) > 0) return false;
  }
  if (hardware.turbo || hardware.launchControl) return false;
  if (
    Number(handling.steering) !== 100
    || Number(handling.brakePower) !== 100
    || Number(handling.suspension) !== 100
    || Number(handling.traction) !== 100
  ) return false;
  return true;
}

/** Mirror of SunsetTuning.BuildVehicleInfo + GetVehicleTuningInfo public fields. */
function buildEcuPublic(ecuRaw: unknown): VehicleProfileDetails["ecu"] {
  if (isStockEcu(ecuRaw)) {
    return {
      tuned: false,
      stock: true,
      chips: [],
    };
  }
  const o = typeof ecuRaw === "object" && ecuRaw ? ecuRaw as Record<string, unknown> : {};
  const stage = String(o.stage ?? "civil");
  const exhaust = String(o.exhaust ?? "pop_bang");
  const pop = typeof o.pop === "object" && o.pop ? o.pop as Record<string, unknown> : {};
  const flames = typeof o.flames === "object" && o.flames ? o.flames as Record<string, unknown> : {};
  const antiLag = typeof o.antiLag === "object" && o.antiLag ? o.antiLag as Record<string, unknown> : {};
  const nitrous = typeof o.nitrous === "object" && o.nitrous ? o.nitrous as Record<string, unknown> : {};
  const drift = typeof o.drift === "object" && o.drift ? o.drift as Record<string, unknown> : {};
  const hardware = typeof o.hardware === "object" && o.hardware ? o.hardware as Record<string, unknown> : {};
  const dyno = typeof o.dyno === "object" && o.dyno ? o.dyno as Record<string, unknown> : {};

  const chips: string[] = [stage.toUpperCase()];
  const exhaustKey = EXHAUST_LABEL[exhaust];
  if (exhaustKey) chips.push(exhaust.split("_").join(" ").toUpperCase());
  if (pop.enabled) chips.push("POP&BANG");
  if (flames.enabled) chips.push("FLAMES");
  if (antiLag.enabled) chips.push("ANTI-LAG");
  if (nitrous.installed) chips.push(`NOS S${Number(nitrous.level) || 1}`);
  if (drift.enabled) chips.push("DRIFT");
  if (hardware.turbo) chips.push("TURBO");
  if (Number(hardware.engine) > 0) chips.push(`ENG ${hardware.engine}`);
  const lastHp = Math.max(0, Math.floor(Number(dyno.lastHp) || 0));
  if (lastHp > 0) chips.push(`${lastHp} HP`);

  return {
    tuned: true,
    stock: false,
    stageKey: STAGE_LABEL[stage] ?? STAGE_LABEL.civil,
    exhaustKey: EXHAUST_LABEL[exhaust] ?? EXHAUST_LABEL.pop_bang,
    chips: chips.slice(0, 8),
    dynoHp: lastHp > 0 ? lastHp : undefined,
    dynoTorque: Math.max(0, Math.floor(Number(dyno.lastTorque) || 0)) || undefined,
  };
}

function buildColors(props: Record<string, unknown>, cosmetics: SanitizedCosmetics): VehicleColorDisplay[] {
  const colors: VehicleColorDisplay[] = [];
  const hasCosmetics = props.cosmetics != null;

  if (hasCosmetics) {
    colors.push({ kind: "rgb", role: "primary", rgb: cosmetics.primary, hex: toHex(cosmetics.primary) });
    colors.push({ kind: "rgb", role: "secondary", rgb: cosmetics.secondary, hex: toHex(cosmetics.secondary) });
    return colors;
  }

  const customP = rgbFromUnknown(props.customPrimaryColor);
  const customS = rgbFromUnknown(props.customSecondaryColor);
  if (customP) colors.push({ kind: "rgb", role: "primary", rgb: customP, hex: toHex(customP) });
  else if (props.color1 != null && Number(props.color1) >= 0) {
    colors.push({ kind: "gta", role: "primary", gtaIndex: Math.floor(Number(props.color1)) });
  }

  if (customS) colors.push({ kind: "rgb", role: "secondary", rgb: customS, hex: toHex(customS) });
  else if (props.color2 != null && Number(props.color2) >= 0) {
    colors.push({ kind: "gta", role: "secondary", gtaIndex: Math.floor(Number(props.color2)) });
  }

  return colors;
}

function buildCosmeticLines(cosmetics: SanitizedCosmetics, props: Record<string, unknown>): VehicleProfileDetails["cosmetics"] {
  const lines: VehicleProfileDetails["cosmetics"] = [];
  const finishKey = PAINT_FINISH[cosmetics.paintType];
  if (finishKey && cosmetics.paintType !== 0) {
    lines.push({ labelKey: "players.vehicle_paint_finish", value: finishKey });
  }
  if (cosmetics.pearl > 0) {
    lines.push({ labelKey: "players.vehicle_pearlescent", value: `#${cosmetics.pearl}` });
  }
  const tint = cosmetics.windowTint || Math.floor(Number(props.windowTint) || 0);
  if (tint > 0) {
    const tintKey = WINDOW_TINT[tint];
    if (tintKey) lines.push({ labelKey: "players.vehicle_window_tint", value: tintKey });
  }
  if (cosmetics.xenon) {
    lines.push({ labelKey: "players.vehicle_xenon", value: "players.vehicle_installed" });
  }
  if (cosmetics.neon.enabled) {
    lines.push({
      labelKey: "players.vehicle_neon",
      valueKey: "players.vehicle_rgb_triplet",
      valueParams: {
        r: cosmetics.neon.color.r,
        g: cosmetics.neon.color.g,
        b: cosmetics.neon.color.b,
      },
    });
  }
  if (cosmetics.tyreSmoke) {
    lines.push({
      labelKey: "players.vehicle_tyre_smoke",
      valueKey: "players.vehicle_rgb_triplet",
      valueParams: {
        r: cosmetics.tyreSmokeColor.r,
        g: cosmetics.tyreSmokeColor.g,
        b: cosmetics.tyreSmokeColor.b,
      },
    });
  }
  const livery = cosmetics.mods.livery;
  if (livery != null && livery >= 0) {
    lines.push({ labelKey: "players.vehicle_livery", value: String(livery + 1) });
  }
  return lines.slice(0, 6);
}

export function buildVehicleProfileDetails(propsRaw: string | Record<string, unknown> | null | undefined): VehicleProfileDetails {
  const props = parseVehicleProps(propsRaw);
  const cosmetics = sanitizeCosmetics(props.cosmetics);

  const performance = {
    engine: gtaModLevel(props.modEngine, 4),
    brakes: gtaModLevel(props.modBrakes, 3),
    transmission: gtaModLevel(props.modTransmission, 3),
    suspension: gtaModLevel(props.modSuspension, 4),
    turbo: modTurboInstalled(props.modTurbo),
    allStock: false,
  };
  performance.allStock =
    isStockMod(performance.engine)
    && isStockMod(performance.brakes)
    && isStockMod(performance.transmission)
    && isStockMod(performance.suspension)
    && !performance.turbo;

  const colors = buildColors(props, cosmetics);
  const pearlescentIndex = cosmetics.pearl || (props.pearlescentColor != null ? Math.floor(Number(props.pearlescentColor)) : undefined);
  const wheelColorIndex = cosmetics.wheel || undefined;
  const paintFinish = PAINT_FINISH[cosmetics.paintType]
    ? { id: cosmetics.paintType, labelKey: PAINT_FINISH[cosmetics.paintType] }
    : undefined;

  return {
    colors,
    pearlescentIndex: pearlescentIndex && pearlescentIndex > 0 ? pearlescentIndex : undefined,
    wheelColorIndex: wheelColorIndex && wheelColorIndex > 0 ? wheelColorIndex : undefined,
    paintFinish,
    performance,
    ecu: buildEcuPublic(props.ecu),
    cosmetics: buildCosmeticLines(cosmetics, props),
  };
}

/** Generated RACKET thumbs are usually >>20KB; tiny PNGs are often broken silhouettes. */
export const MIN_RELIABLE_GENERATED_THUMB_BYTES = 50_000;
