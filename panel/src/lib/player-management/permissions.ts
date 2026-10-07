import type { ManagementSectionId, PlayerManagementSession, StaffActionId } from "./types";

export function canPerformAction(
  action: StaffActionId,
  session: PlayerManagementSession
): boolean {
  const { adminLevel: a, helperLevel: h } = session;

  switch (action) {
    case "warn":
      return a >= 1;
    case "mute":
    case "unmute":
      return a >= 1 || h >= 1;
    case "kick":
    case "jail":
    case "unjail":
    case "ban":
      return a >= 2;
    case "unban":
    case "set_faction":
    case "faction_warn":
    case "faction_kick":
    case "set_author":
    case "add_badge":
    case "remove_badge":
      return a >= 3;
    case "set_clan":
    case "clan_warn":
    case "clan_kick":
    case "set_cash":
    case "set_bank":
    case "set_level":
    case "set_hours":
    case "set_fp":
    case "give_item":
    case "remove_item":
    case "clear_inventory":
      return a >= 4;
    case "set_premium_points":
    case "set_email":
    case "reset_password":
    case "remove_sanction":
      return a >= 5;
    case "staff_set_admin":
    case "staff_set_helper":
    case "staff_remove_role":
      return a >= 6;
    default:
      return false;
  }
}

export function canOpenManagement(session: PlayerManagementSession): boolean {
  return session.adminLevel >= 1 || session.helperLevel >= 1;
}

export function canViewSection(section: ManagementSectionId, session: PlayerManagementSession): boolean {
  switch (section) {
    case "economy":
    case "faction_clan":
    case "inventory":
      return session.adminLevel >= 4;
    case "account":
      return session.adminLevel >= 5;
    case "badges":
      return session.adminLevel >= 3;
    case "sanctions":
      return session.adminLevel >= 5;
    default:
      return false;
  }
}

export function actionRequiresOnline(action: StaffActionId): boolean {
  return ["kick", "jail", "unjail", "give_item", "remove_item"].includes(action);
}

export function actionRequiresReason(action: StaffActionId): boolean {
  return !["unmute", "unjail", "unban"].includes(action);
}

export function actionHasDuration(action: StaffActionId): boolean {
  return action === "ban" || action === "mute" || action === "jail";
}

export function actionIsDestructive(action: StaffActionId): boolean {
  return ["ban", "clear_inventory", "reset_password", "staff_remove_role", "remove_sanction", "faction_kick", "clan_kick"].includes(
    action
  );
}
