export type FactionLogCategory = "all" | "members" | "ranks" | "warnings" | "leadership" | "applications";

export const FACTION_LOG_PAGE_SIZES = [25, 50] as const;

const LEGACY_ACTION_TO_EVENT: Record<string, string> = {
  invite_sent: "member_invited",
  invite_accepted: "member_joined",
  invite_declined: "application_declined",
  leave: "member_left",
  uninvite: "member_kicked",
  uninvite_fp: "member_kicked",
  uninvite_offline: "member_kicked",
  uninvite_fp_offline: "member_kicked",
  promote: "member_rank_changed",
  giverank: "member_rank_changed",
  rank_up: "member_promoted",
  rank_down: "member_demoted",
  fwarn: "member_warned",
  panel_warn: "member_warned",
  setleader: "leader_assigned",
  removeleader: "leader_removed",
  panel_set_faction: "member_rank_changed",
  panel_set_rank: "member_rank_changed",
  faction_set_member: "application_accepted",
  faction_kick: "member_kicked",
  faction_kick_fp: "member_kicked",
  panel_pardon_fp: "member_unsuspended",
  fp_pardon: "member_unsuspended",
  leave_fp: "member_suspended",
  resign_accepted: "member_left",
  resign_accepted_fp: "member_kicked",
  resign_submitted: "member_left",
  grade_labels: "rank_structure_changed",
};

const CATEGORY_EVENT_TYPES: Record<Exclude<FactionLogCategory, "all">, string[]> = {
  members: [
    "member_invited",
    "member_joined",
    "member_left",
    "member_kicked",
    "member_suspended",
    "member_unsuspended",
  ],
  ranks: ["member_promoted", "member_demoted", "member_rank_changed", "rank_structure_changed"],
  warnings: ["member_warned"],
  leadership: ["leader_assigned", "leader_removed", "leadership_other"],
  applications: ["application_accepted", "application_rejected", "application_declined"],
};

export function normalizeFactionEventType(raw: string): string {
  const key = (raw || "").trim();
  if (!key) return "unknown";
  return LEGACY_ACTION_TO_EVENT[key] ?? key;
}

export function factionLogCategoryForEvent(eventType: string): Exclude<FactionLogCategory, "all"> {
  const normalized = normalizeFactionEventType(eventType);
  for (const [category, events] of Object.entries(CATEGORY_EVENT_TYPES) as [
    Exclude<FactionLogCategory, "all">,
    string[],
  ][]) {
    if (events.includes(normalized)) return category;
  }
  if (normalized.startsWith("application_")) return "applications";
  if (normalized.includes("leader")) return "leadership";
  if (normalized.includes("warn")) return "warnings";
  if (normalized.includes("rank") || normalized.includes("promot") || normalized.includes("demot")) {
    return "ranks";
  }
  return "members";
}

function legacyActionsForCategory(category: Exclude<FactionLogCategory, "all">): string[] {
  const canonical = new Set(CATEGORY_EVENT_TYPES[category]);
  const legacy: string[] = [];
  for (const [action, event] of Object.entries(LEGACY_ACTION_TO_EVENT)) {
    if (canonical.has(event)) legacy.push(action);
  }
  return legacy;
}

export function sqlCategoryFilter(category: FactionLogCategory): { clause: string; params: string[] } {
  if (category === "all") return { clause: "", params: [] };
  const types = [
    ...new Set([...CATEGORY_EVENT_TYPES[category], ...legacyActionsForCategory(category)]),
  ];
  const placeholders = types.map(() => "?").join(", ");
  return {
    clause: ` AND fl.event_type IN (${placeholders}) `,
    params: types,
  };
}

export function i18nKeyForFactionLogEvent(eventType: string): string {
  const normalized = normalizeFactionEventType(eventType);
  return `factionLogs.events.${normalized}`;
}
