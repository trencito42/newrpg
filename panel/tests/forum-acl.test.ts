import { describe, expect, it } from "vitest";
import { evaluateForumCapability, type ForumAccessRule, type ForumViewerContext } from "../src/lib/forum-acl";
import type { Forum } from "../src/lib/forum-types";

const forum = (access_type: Forum["access_type"] = "public", access_target: string | null = null): Forum => ({
  id: 10, category_id: 2, parent_forum_id: null, name: "Internal", slug: "internal", description: null,
  icon: "MessageSquare", access_type, access_target, inherit_category_permissions: true, sort_order: 0,
  is_locked: false, is_visible: true, topic_count: 0, post_count: 0, last_topic_id: null,
  last_topic_title: null, last_post_id: null, last_post_at: null, last_post_account_id: null,
  last_post_character_id: null, last_post_username: null, topic_template: null, created_at: "2026-01-01",
});
const viewer = (patch: Partial<ForumViewerContext> = {}): ForumViewerContext => ({
  accountId: null, characterId: null, adminLevel: 0, helperLevel: 0, factionId: null,
  factionRank: 0, clanId: null, clanRank: 0, ...patch,
});
const rule = (patch: Partial<ForumAccessRule>): ForumAccessRule => ({
  id: 1, scope_type: "forum", scope_id: 10, principal_type: "everyone", principal_id: "", effect: "allow",
  minimum_rank: null, minimum_staff_level: null, can_view: 1, can_create_topic: 0, can_reply: 0,
  can_edit_own: 0, can_delete_own: 0, can_moderate: 0, can_manage: 0, ...patch,
});

describe("forum ACL", () => {
  it("allows logged-out visitors into public forums", () => expect(evaluateForumCapability(forum(), viewer(), [], "view")).toBe(true));
  it("allows only the selected LSPD character into an LSPD forum", () => {
    const rules = [rule({ principal_type: "faction", principal_id: "police", minimum_rank: 2 })];
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 1, characterId: 8, factionId: "police", factionRank: 2 }), rules, "view")).toBe(true);
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 1, characterId: 9, factionId: "medic", factionRank: 7 }), rules, "view")).toBe(false);
  });
  it("isolates clan forums by selected-character membership", () => {
    const rules = [rule({ principal_type: "clan", principal_id: "17" })];
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 1, clanId: 17 }), rules, "view")).toBe(true);
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 2, clanId: 18 }), rules, "view")).toBe(false);
  });
  it("gives administrators the intended access and moderation override", () => {
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 3, adminLevel: 1 }), [], "view")).toBe(true);
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 3, adminLevel: 1 }), [], "moderate")).toBe(true);
  });
  it("does not grant posting capability to logged-out visitors", () => expect(evaluateForumCapability(forum(), viewer(), [], "reply")).toBe(false));
  it("lets forum rules override inherited category rules", () => {
    const rules = [
      rule({ id: 1, scope_type: "category", scope_id: 2, principal_type: "faction", principal_id: "medic" }),
      rule({ id: 2, scope_type: "forum", principal_type: "faction", principal_id: "police" }),
    ];
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 1, factionId: "police" }), rules, "view")).toBe(true);
    expect(evaluateForumCapability(forum("custom"), viewer({ accountId: 2, factionId: "medic" }), rules, "view")).toBe(false);
  });
  it("denies anonymous sitemap eligibility for private ACL forums", () => {
    const rules = [rule({ principal_type: "faction", principal_id: "police" })];
    expect(evaluateForumCapability(forum("custom"), viewer(), rules, "view")).toBe(false);
  });
});
