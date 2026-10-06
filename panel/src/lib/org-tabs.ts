const FACTION_TABS = ["overview", "members", "applications", "rules", "ranks"] as const;
const CLAN_TABS = ["overview", "members", "applications", "rules", "turfs"] as const;

export type FactionTab = (typeof FACTION_TABS)[number];
export type ClanTab = (typeof CLAN_TABS)[number];

export function parseFactionTab(raw: string | undefined, includeRanks: boolean): FactionTab {
  if (raw === "members" || raw === "applications" || raw === "rules") return raw;
  if (includeRanks && raw === "ranks") return "ranks";
  return "overview";
}

export function parseClanTab(raw: string | undefined): ClanTab {
  if (raw === "members" || raw === "applications" || raw === "rules" || raw === "turfs") return raw;
  return "overview";
}
