import type { Forum } from "./forum-types";

export type ForumCapability = "view" | "create_topic" | "reply" | "edit_own" | "delete_own" | "moderate" | "manage";

export interface ForumViewerContext {
  accountId: number | null;
  characterId: number | null;
  adminLevel: number;
  helperLevel: number;
  factionId: string | null;
  factionRank: number;
  clanId: number | null;
  clanRank: number;
}

export interface ForumAccessRule {
  id: number;
  scope_type: "category" | "forum";
  scope_id: number;
  principal_type: "everyone" | "authenticated" | "account" | "faction" | "clan" | "staff" | "admin" | "helper";
  principal_id: string;
  effect: "allow" | "deny";
  minimum_rank: number | null;
  minimum_staff_level: number | null;
  can_view: number;
  can_create_topic: number;
  can_reply: number;
  can_edit_own: number;
  can_delete_own: number;
  can_moderate: number;
  can_manage: number;
}

const capabilityColumn: Record<ForumCapability, keyof ForumAccessRule> = {
  view: "can_view", create_topic: "can_create_topic", reply: "can_reply", edit_own: "can_edit_own",
  delete_own: "can_delete_own", moderate: "can_moderate", manage: "can_manage",
};

function principalMatches(rule: ForumAccessRule, viewer: ForumViewerContext): boolean {
  const rank = Number(rule.minimum_rank) || 0;
  const staff = Number(rule.minimum_staff_level) || 1;
  switch (rule.principal_type) {
    case "everyone": return true;
    case "authenticated": return viewer.accountId !== null;
    case "account": return viewer.accountId === Number(rule.principal_id);
    case "faction": return viewer.factionId === rule.principal_id.toLowerCase() && viewer.factionRank >= rank;
    case "clan": return viewer.clanId === Number(rule.principal_id) && viewer.clanRank >= rank;
    case "staff": return viewer.adminLevel >= staff || viewer.helperLevel >= staff;
    case "admin": return viewer.adminLevel >= staff;
    case "helper": return viewer.helperLevel >= staff || viewer.adminLevel >= 1;
  }
}

function legacyAllows(forum: Forum, viewer: ForumViewerContext, capability: ForumCapability): boolean {
  if (viewer.adminLevel >= 1) return true;
  if (!forum.is_visible) return false;
  let view = false;
  if (forum.access_type === "public") view = true;
  else if (forum.access_type === "registered") view = viewer.accountId !== null;
  else if (forum.access_type === "staff") view = viewer.adminLevel >= 1 || viewer.helperLevel >= 1;
  else if (forum.access_type === "faction") view = Boolean(viewer.factionId && forum.access_target && viewer.factionId === forum.access_target.toLowerCase());
  else if (forum.access_type === "clan") view = viewer.clanId !== null && Boolean(forum.access_target) && viewer.clanId === Number(forum.access_target);
  if (capability === "view") return view;
  if (capability === "moderate") return view && viewer.helperLevel >= 1;
  if (capability === "manage") return false;
  return view && viewer.accountId !== null && !forum.is_locked;
}

export function evaluateForumCapability(forum: Forum, viewer: ForumViewerContext, rules: ForumAccessRule[], capability: ForumCapability): boolean {
  if (viewer.adminLevel >= 1) return true;
  const allConfigured = rules.filter((rule) => Number(rule[capabilityColumn[capability]]) === 1);
  const forumConfigured = allConfigured.filter((rule) => rule.scope_type === "forum");
  const configured = forumConfigured.length ? forumConfigured : allConfigured;
  const matching = configured.filter((rule) => principalMatches(rule, viewer));
  if (matching.some((rule) => rule.effect === "deny")) return false;
  if (matching.some((rule) => rule.effect === "allow")) return true;
  if (configured.length) return false;
  return legacyAllows(forum, viewer, capability);
}
