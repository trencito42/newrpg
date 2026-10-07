import type { ManagementSectionId, StaffActionId } from "./types";

export const QUICK_MOD_ACTIONS: StaffActionId[] = ["warn", "mute", "kick", "ban"];

export const OTHER_MOD_ACTIONS: StaffActionId[] = ["jail", "unjail", "unmute", "unban"];

export const SECTION_ACTIONS: Record<ManagementSectionId, StaffActionId[]> = {
  economy: ["set_cash", "set_bank", "set_level", "set_hours", "set_fp"],
  account: ["set_email", "reset_password", "set_premium_points", "staff_set_admin"],
  faction_clan: ["set_faction", "faction_warn", "faction_kick", "set_clan", "clan_warn", "clan_kick"],
  inventory: ["give_item", "remove_item", "clear_inventory"],
  badges: ["set_author", "add_badge", "remove_badge"],
  sanctions: ["remove_sanction"],
};

export const DURATION_PRESETS = [
  { minutes: 15, key: "15m" },
  { minutes: 60, key: "1h" },
  { minutes: 1440, key: "1d" },
  { minutes: 10080, key: "7d" },
  { minutes: 43200, key: "perm" },
] as const;
