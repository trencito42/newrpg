import type { Locale } from "@/lib/i18n";

export type StaffActionId =
  | "warn"
  | "mute"
  | "unmute"
  | "kick"
  | "ban"
  | "unban"
  | "jail"
  | "unjail"
  | "set_cash"
  | "set_bank"
  | "set_level"
  | "set_hours"
  | "set_fp"
  | "set_email"
  | "reset_password"
  | "set_premium_points"
  | "staff_set_admin"
  | "staff_set_helper"
  | "staff_remove_role"
  | "set_faction"
  | "faction_warn"
  | "faction_kick"
  | "set_clan"
  | "clan_warn"
  | "clan_kick"
  | "give_item"
  | "remove_item"
  | "clear_inventory"
  | "set_author"
  | "add_badge"
  | "remove_badge"
  | "remove_sanction";

export type ManagementSectionId =
  | "economy"
  | "account"
  | "faction_clan"
  | "inventory"
  | "badges"
  | "sanctions";

export interface PlayerManagementBadge {
  id: number;
  badge_key: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  bg_color: string | null;
}

export interface PlayerManagementSanction {
  id: number;
  action: string;
  target_name: string;
  admin_name: string;
  reason: string;
  duration_min: number | null;
  created_at: string;
}

export interface PlayerManagementTarget {
  account_id: number;
  character_id: number;
  username: string;
  email?: string | null;
  level: number;
  hours?: number;
  cash?: number;
  bank?: number;
  premium_points?: number;
  faction_id?: string | null;
  faction_rank?: number;
  clan_id?: number | null;
  clan_rank?: number;
  clan_tag?: string | null;
  clan_tag_color?: string | null;
  clan_tag_style?: string | null;
  is_author?: number;
  is_online: boolean;
  last_played?: string | null;
  avatar_skin?: string | null;
}

export interface PlayerManagementSession {
  adminLevel: number;
  helperLevel: number;
}

export type DrawerScreen =
  | { kind: "home" }
  | { kind: "section"; section: ManagementSectionId }
  | { kind: "form"; action: StaffActionId }
  | { kind: "confirm"; action: StaffActionId; payload: Record<string, unknown> };

export type TranslateFn = (locale: Locale, key: string, vars?: Record<string, string | number>) => string;
