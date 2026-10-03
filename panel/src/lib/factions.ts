// Canonical Faction Registry and Colors
// Sourced from sunset_core/shared/factions.lua

export interface FactionConfig {
  id: string;
  label: string;
  type: "legal" | "illegal";
  factionTypeKey: string;
  descriptionKey: string;
  markerRgb: [number, number, number];
  color: string; // Contrast-safe web display color matching game marker
}

export const CANONICAL_FACTIONS: Record<string, FactionConfig> = {
  police: {
    id: "police",
    label: "LSPD",
    type: "legal",
    factionTypeKey: "faction_catalog.police.type",
    descriptionKey: "faction_catalog.police.description",
    markerRgb: [0, 100, 200],
    color: "#3b82f6", // Blue
  },
  sheriff: {
    id: "sheriff",
    label: "San Andreas Sheriff",
    type: "legal",
    factionTypeKey: "faction_catalog.sheriff.type",
    descriptionKey: "faction_catalog.sheriff.description",
    markerRgb: [160, 110, 40],
    color: "#d97706", // Amber / Tan gold
  },
  fib: {
    id: "fib",
    label: "FIB",
    type: "legal",
    factionTypeKey: "faction_catalog.fib.type",
    descriptionKey: "faction_catalog.fib.description",
    markerRgb: [20, 20, 20],
    color: "#94a3b8", // Dark silver / federal slate
  },
  medic: {
    id: "medic",
    label: "Pillbox EMS",
    type: "legal",
    factionTypeKey: "faction_catalog.medic.type",
    descriptionKey: "faction_catalog.medic.description",
    markerRgb: [255, 50, 50],
    color: "#ef4444", // Red
  },
  taxi: {
    id: "taxi",
    label: "Downtown Cab Co.",
    type: "legal",
    factionTypeKey: "faction_catalog.taxi.type",
    descriptionKey: "faction_catalog.taxi.description",
    markerRgb: [255, 200, 0],
    color: "#eab308", // Yellow
  },
  mechanic: {
    id: "mechanic",
    label: "LS Customs",
    type: "legal",
    factionTypeKey: "faction_catalog.mechanic.type",
    descriptionKey: "faction_catalog.mechanic.description",
    markerRgb: [255, 140, 0],
    color: "#f97316", // Orange
  },
  lsfd: {
    id: "lsfd",
    label: "LS Fire Department",
    type: "legal",
    factionTypeKey: "faction_catalog.lsfd.type",
    descriptionKey: "faction_catalog.lsfd.description",
    markerRgb: [255, 80, 0],
    color: "#ea580c", // Red-orange
  },
  lssi: {
    id: "lssi",
    label: "LSSI — License & Safety",
    type: "legal",
    factionTypeKey: "faction_catalog.lssi.type",
    descriptionKey: "faction_catalog.lssi.description",
    markerRgb: [50, 200, 80],
    color: "#22c55e", // Emerald green
  },
  sunset_cartel: {
    id: "sunset_cartel",
    label: "Sunset Cartel",
    type: "illegal",
    factionTypeKey: "faction_catalog.sunset_cartel.type",
    descriptionKey: "faction_catalog.sunset_cartel.description",
    markerRgb: [180, 0, 0],
    color: "#dc2626", // Crimson
  },
  night_syndicate: {
    id: "night_syndicate",
    label: "Night Syndicate",
    type: "illegal",
    factionTypeKey: "faction_catalog.night_syndicate.type",
    descriptionKey: "faction_catalog.night_syndicate.description",
    markerRgb: [80, 0, 120],
    color: "#a855f7", // Violet / Purple
  },
};

/**
 * Returns the canonical color for a faction or job ID.
 * Returns null if the ID is not a recognized faction (e.g. civilian jobs or unemployed).
 */
export function getFactionColor(factionId: string | null | undefined): string | null {
  if (!factionId) return null;
  const f = CANONICAL_FACTIONS[factionId.toLowerCase()];
  return f ? f.color : null;
}

/**
 * Returns the canonical label for a faction.
 */
export function getFactionLabel(factionId: string | null | undefined): string {
  if (!factionId) return "";
  const f = CANONICAL_FACTIONS[factionId.toLowerCase()];
  return f ? f.label : factionId;
}

/**
 * Checks if a given job identifier is a faction.
 */
export function isFaction(jobId: string | null | undefined): boolean {
  if (!jobId) return false;
  return Boolean(CANONICAL_FACTIONS[jobId.toLowerCase()]);
}
