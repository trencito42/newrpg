-- Additive production upgrade for forum installations created before identity/ACL support.
ALTER TABLE panel_forums
  ADD COLUMN IF NOT EXISTS inherit_category_permissions TINYINT(1) NOT NULL DEFAULT 1 AFTER access_target,
  ADD COLUMN IF NOT EXISTS last_post_id INT UNSIGNED NULL AFTER last_topic_title,
  ADD COLUMN IF NOT EXISTS last_post_character_id INT UNSIGNED NULL AFTER last_post_account_id;

ALTER TABLE panel_forum_topics
  ADD COLUMN IF NOT EXISTS author_character_id INT UNSIGNED NULL COMMENT 'selected characters.id at creation time' AFTER account_id,
  ADD COLUMN IF NOT EXISTS last_post_character_id INT UNSIGNED NULL AFTER last_post_account_id,
  ADD INDEX IF NOT EXISTS idx_topic_author_character (author_character_id);

ALTER TABLE panel_forum_posts
  ADD COLUMN IF NOT EXISTS author_character_id INT UNSIGNED NULL COMMENT 'selected characters.id at creation time' AFTER account_id,
  ADD INDEX IF NOT EXISTS idx_post_author_character (author_character_id);

CREATE TABLE IF NOT EXISTS panel_forum_access_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scope_type ENUM('category','forum') NOT NULL,
  scope_id INT UNSIGNED NOT NULL,
  principal_type ENUM('everyone','authenticated','account','faction','clan','staff','admin','helper') NOT NULL,
  principal_id VARCHAR(64) NOT NULL DEFAULT '',
  effect ENUM('allow','deny') NOT NULL DEFAULT 'allow',
  minimum_rank SMALLINT UNSIGNED NULL,
  minimum_staff_level SMALLINT UNSIGNED NULL,
  can_view TINYINT(1) NOT NULL DEFAULT 1,
  can_create_topic TINYINT(1) NOT NULL DEFAULT 1,
  can_reply TINYINT(1) NOT NULL DEFAULT 1,
  can_edit_own TINYINT(1) NOT NULL DEFAULT 1,
  can_delete_own TINYINT(1) NOT NULL DEFAULT 1,
  can_moderate TINYINT(1) NOT NULL DEFAULT 0,
  can_manage TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_forum_acl_principal (scope_type, scope_id, principal_type, principal_id),
  INDEX idx_forum_acl_scope (scope_type, scope_id),
  INDEX idx_forum_acl_principal (principal_type, principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A character can be inferred safely only when the author account owns exactly one.
UPDATE panel_forum_topics t
JOIN (
  SELECT p.account_id, MIN(c.id) AS character_id
  FROM players p JOIN characters c ON c.player_id = p.id
  GROUP BY p.account_id HAVING COUNT(*) = 1
) single_character ON single_character.account_id = t.account_id
SET t.author_character_id = single_character.character_id
WHERE t.author_character_id IS NULL;

UPDATE panel_forum_posts ppost
JOIN (
  SELECT p.account_id, MIN(c.id) AS character_id
  FROM players p JOIN characters c ON c.player_id = p.id
  GROUP BY p.account_id HAVING COUNT(*) = 1
) single_character ON single_character.account_id = ppost.account_id
SET ppost.author_character_id = single_character.character_id
WHERE ppost.author_character_id IS NULL;

UPDATE panel_forum_topics t
LEFT JOIN panel_forum_posts p ON p.id = t.last_post_id
SET t.last_post_character_id = p.author_character_id
WHERE t.last_post_id IS NOT NULL AND t.last_post_character_id IS NULL;

UPDATE panel_forums f
LEFT JOIN panel_forum_topics t ON t.id = f.last_topic_id
SET f.last_post_id = t.last_post_id,
    f.last_post_character_id = t.last_post_character_id
WHERE f.last_topic_id IS NOT NULL;
