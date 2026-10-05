import "server-only";
import { dbExecute } from "./db";

export async function refreshForumTopicStats(topicId: number): Promise<void> {
  await dbExecute(
    `UPDATE panel_forum_topics t SET
       reply_count = (SELECT COUNT(*) FROM panel_forum_posts p WHERE p.topic_id = t.id AND p.deleted_at IS NULL AND p.is_first_post = 0),
       last_post_id = (SELECT p.id FROM panel_forum_posts p WHERE p.topic_id = t.id AND p.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_at = (SELECT p.created_at FROM panel_forum_posts p WHERE p.topic_id = t.id AND p.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_account_id = (SELECT p.account_id FROM panel_forum_posts p WHERE p.topic_id = t.id AND p.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_character_id = (SELECT p.author_character_id FROM panel_forum_posts p WHERE p.topic_id = t.id AND p.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_username = (SELECT p.author_username FROM panel_forum_posts p WHERE p.topic_id = t.id AND p.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1)
     WHERE t.id = ?`, [topicId]
  );
}

export async function refreshForumStats(forumId: number): Promise<void> {
  await dbExecute(
    `UPDATE panel_forums f SET
       topic_count = (SELECT COUNT(*) FROM panel_forum_topics t WHERE t.forum_id = f.id AND t.deleted_at IS NULL),
       post_count = (SELECT COUNT(*) FROM panel_forum_posts p WHERE p.forum_id = f.id AND p.deleted_at IS NULL),
       last_topic_id = (SELECT t.id FROM panel_forum_topics t WHERE t.forum_id = f.id AND t.deleted_at IS NULL ORDER BY t.last_post_at DESC, t.id DESC LIMIT 1),
       last_topic_title = (SELECT t.title FROM panel_forum_topics t WHERE t.forum_id = f.id AND t.deleted_at IS NULL ORDER BY t.last_post_at DESC, t.id DESC LIMIT 1),
       last_post_id = (SELECT p.id FROM panel_forum_posts p JOIN panel_forum_topics t ON t.id = p.topic_id WHERE p.forum_id = f.id AND p.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_at = (SELECT p.created_at FROM panel_forum_posts p JOIN panel_forum_topics t ON t.id = p.topic_id WHERE p.forum_id = f.id AND p.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_account_id = (SELECT p.account_id FROM panel_forum_posts p JOIN panel_forum_topics t ON t.id = p.topic_id WHERE p.forum_id = f.id AND p.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_character_id = (SELECT p.author_character_id FROM panel_forum_posts p JOIN panel_forum_topics t ON t.id = p.topic_id WHERE p.forum_id = f.id AND p.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1),
       last_post_username = (SELECT p.author_username FROM panel_forum_posts p JOIN panel_forum_topics t ON t.id = p.topic_id WHERE p.forum_id = f.id AND p.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 1)
     WHERE f.id = ?`, [forumId]
  );
}
