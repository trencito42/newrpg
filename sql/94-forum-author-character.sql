-- Forum author character binding for per-character public activity (panel)
ALTER TABLE panel_forum_topics
  ADD COLUMN author_character_id INT UNSIGNED NULL AFTER account_id,
  ADD COLUMN created_at_unix BIGINT UNSIGNED NULL AFTER created_at;

ALTER TABLE panel_forum_posts
  ADD COLUMN author_character_id INT UNSIGNED NULL AFTER account_id,
  ADD COLUMN created_at_unix BIGINT UNSIGNED NULL AFTER created_at;

CREATE INDEX idx_topic_author_char ON panel_forum_topics (author_character_id);
CREATE INDEX idx_post_author_char ON panel_forum_posts (author_character_id);
