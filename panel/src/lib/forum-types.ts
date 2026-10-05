// ============================================================
// forum-types.ts — Domain types for the RACKET panel forum
// ============================================================

export type ForumAccessType = "public" | "registered" | "staff" | "faction" | "clan" | "custom";
export type TopicType = "normal" | "pinned" | "announcement" | "global";
export type TopicStatus = "open" | "locked";
export type ReportReason = "spam" | "off_topic" | "harassment" | "advertising" | "rule_violation" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type ModlogTargetType = "topic" | "post" | "forum" | "category";

export interface ForumCategory {
  id: number;
  name_en: string;
  name_ro: string;
  slug: string;
  description_en: string | null;
  description_ro: string | null;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

export interface Forum {
  id: number;
  category_id: number;
  parent_forum_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  access_type: ForumAccessType;
  access_target: string | null;
  inherit_category_permissions: boolean;
  sort_order: number;
  is_locked: boolean;
  is_visible: boolean;
  topic_count: number;
  post_count: number;
  last_topic_id: number | null;
  last_topic_title: string | null;
  last_post_id: number | null;
  last_post_at: string | null;
  last_post_account_id: number | null;
  last_post_character_id: number | null;
  last_post_username: string | null;
  topic_template: string | null;
  created_at: string;
}

export interface ForumTopic {
  id: number;
  forum_id: number;
  account_id: number;
  author_character_id: number | null;
  author_username: string;
  title: string;
  slug: string;
  type: TopicType;
  status: TopicStatus;
  view_count: number;
  reply_count: number;
  last_post_id: number | null;
  last_post_at: string | null;
  last_post_account_id: number | null;
  last_post_character_id: number | null;
  last_post_username: string | null;
  has_poll: boolean;
  template_data: Record<string, unknown> | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_account_id: number | null;
  delete_reason: string | null;
}

export interface ForumTopicListItem extends ForumTopic {
  is_unread?: boolean;
  last_read_post_id?: number | null;
}

export interface ForumPost {
  id: number;
  topic_id: number;
  forum_id: number;
  account_id: number;
  author_character_id: number | null;
  author_username: string;
  content: string;
  is_first_post: boolean;
  edited_at: string | null;
  edited_by_account_id: number | null;
  edit_reason: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_account_id: number | null;
  delete_reason: string | null;
}

export interface ForumPostItem extends ForumPost {
  author_identity?: import("./player-identity").ResolvedPlayerIdentity;
  edited_by_identity?: import("./player-identity").ResolvedPlayerIdentity;
  deleted_by_identity?: import("./player-identity").ResolvedPlayerIdentity;
  author_admin_level?: number;
  author_helper_level?: number;
  author_post_count?: number;
  author_joined_at?: string;
  deleted_by_username?: string | null;
  edited_by_username?: string | null;
}

export interface ForumReport {
  id: number;
  reporter_account_id: number;
  reporter_username: string;
  topic_id: number;
  post_id: number | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolved_by_account_id: number | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface ForumModlogEntry {
  id: number;
  actor_account_id: number;
  actor_username: string;
  action: string;
  target_type: ModlogTargetType;
  target_id: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ForumPoll {
  id: number;
  topic_id: number;
  question: string;
  max_selections: number;
  allows_change: boolean;
  closes_at: string | null;
  created_at: string;
  options: ForumPollOption[];
  user_vote_option_ids?: number[];
  total_votes?: number;
}

export interface ForumPollOption {
  id: number;
  poll_id: number;
  label: string;
  sort_order: number;
  votes_count: number;
}

export interface ForumPermissions {
  canView: boolean;
  canCreateTopic: boolean;
  canReply: boolean;
  canEditOwn: boolean;
  canDeleteOwn: boolean;
  canModerate: boolean;
  canModDeletePost: boolean;
  canModLockTopic: boolean;
  canModPinTopic: boolean;
  canModMoveTopic: boolean;
  canModRestorePost: boolean;
  canAdminManageForum: boolean;
  canAdminManageCategory: boolean;
}

export interface ForumCategoryWithForums extends ForumCategory {
  forums: Forum[];
}
