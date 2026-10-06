#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const map = {
  Forum: 'forumUi.title',
  'RACKET RPG Community': 'forumUi.community_subtitle',
  'My activity': 'forumUi.my_activity',
  'No forums available': 'forumUi.no_forums',
  topics: 'forumUi.topics',
  posts: 'forumUi.posts',
  ' posts': 'forumUi.posts_suffix',
  'No posts': 'forumUi.no_posts',
  'Search forum': 'forumUi.search_forum',
  'Mark all as read': 'forumUi.mark_all_read',
  Search: 'forumUi.search',
  'Forum Search': 'forumUi.search_title',
  'No results found': 'forumUi.no_results',
  results: 'forumUi.results',
  'New Topic': 'forumUi.new_topic',
  'No topics yet': 'forumUi.no_topics',
  Prev: 'forumUi.prev',
  Next: 'forumUi.next',
  Moderation: 'forumUi.moderation',
  'Moderation Panel': 'forumUi.moderation_panel',
  'Open reports': 'forumUi.open_reports',
  'Open Reports': 'forumUi.open_reports_title',
  'No open reports': 'forumUi.no_open_reports',
  'Reported by': 'forumUi.reported_by',
  'Recent Actions': 'forumUi.recent_actions',
  'No actions': 'forumUi.no_actions',
  'My Activity': 'forumUi.my_activity_title',
  'Nothing to show': 'forumUi.nothing_to_show',
  replies: 'forumUi.replies',
  views: 'forumUi.views',
  by: 'forumUi.by',
  locked: 'forumUi.locked',
  deleted: 'forumUi.deleted',
  Reply: 'forumUi.reply',
  'This topic is locked.': 'forumUi.topic_locked',
  'Log in': 'forumUi.login',
  ' to reply': 'forumUi.login_to_reply',
  'Joined ': 'forumUi.joined_prefix',
  Joined: 'forumUi.joined',
  Write: 'forumUi.write',
  Preview: 'forumUi.preview',
  'Loading preview...': 'forumUi.loading_preview',
  'Nothing to preview': 'forumUi.nothing_to_preview',
  'Log In': 'forumUi.log_in',
  votes: 'forumUi.votes',
  '· Closed': 'forumUi.poll_closed',
  Closes: 'forumUi.closes',
  'edited by': 'forumUi.edited_by',
  'Deleted by': 'forumUi.deleted_by',
  '[post deleted]': 'forumUi.post_deleted',
  'Copy link': 'forumUi.copy_link',
  Edit: 'forumUi.edit',
  Delete: 'forumUi.delete',
  Restore: 'forumUi.restore',
  Report: 'forumUi.report',
  'Report Post': 'forumUi.report_post',
  'Report submitted successfully!': 'forumUi.report_success',
  Reason: 'forumUi.reason',
  'Details (optional)': 'forumUi.details_optional',
  'Submit Report': 'forumUi.submit_report',
  'Post Reply': 'forumUi.post_reply',
  Clear: 'forumUi.clear',
  'Move Topic': 'forumUi.move_topic',
  'Target Forum ID:': 'forumUi.target_forum_id',
  Move: 'forumUi.move',
  '[deleted]': 'forumUi.deleted_short',
  Title: 'forumUi.title_label',
  Content: 'forumUi.content_label',
  'Add a poll': 'forumUi.add_poll',
  Poll: 'forumUi.poll',
  Question: 'forumUi.poll_question',
  Options: 'forumUi.poll_options',
  'Add option': 'forumUi.add_option',
  'Max selections:': 'forumUi.max_selections',
  'Allow vote change': 'forumUi.allow_vote_change',
  'Post Topic': 'forumUi.post_topic',
  Cancel: 'forumUi.cancel',
};

const files = [
  'panel/src/app/forum/[forumSlug]/page.tsx',
  'panel/src/app/forum/mod/page.tsx',
  'panel/src/app/forum/my/page.tsx',
  'panel/src/app/forum/new-topic/[forumId]/page.tsx',
  'panel/src/app/forum/search/page.tsx',
  'panel/src/app/forum/topic/[id]/[slug]/page.tsx',
  'panel/src/components/forum/ForumAuthorPane.tsx',
  'panel/src/components/forum/ForumEditor.tsx',
  'panel/src/components/forum/ForumPermissionGate.tsx',
  'panel/src/components/forum/PollDisplay.tsx',
  'panel/src/components/forum/PostCard.tsx',
  'panel/src/components/forum/PostCardActions.tsx',
  'panel/src/components/forum/PostReportModal.tsx',
  'panel/src/components/forum/ReplyForm.tsx',
  'panel/src/components/forum/TopicActionsMenu.tsx',
  'panel/src/components/forum/TopicListItem.tsx',
];

for (const rel of files) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('from "@/lib/i18n"') && !src.includes("from '@/lib/i18n'")) {
    if (src.includes('"use client"')) {
      src = src.replace(
        /("use client";\n)/,
        '$1import { t, type Locale } from "@/lib/i18n";\n'
      );
    } else {
      src = src.replace(
        /^(import .+\n)+/m,
        (m) => `${m}import { t } from "@/lib/i18n";\n`
      );
    }
  }
  for (const [text, key] of Object.entries(map)) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    src = src.replace(new RegExp(`\\{"${escaped}"\\}`, 'g'), `{t(locale, "${key}")}`);
  }
  fs.writeFileSync(file, src);
  console.log('updated', rel);
}
