-- Forum author character binding (deterministic identity per post/topic).
DELIMITER $$

DROP PROCEDURE IF EXISTS sunset_migrate_forum_author_character$$
CREATE PROCEDURE sunset_migrate_forum_author_character()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panel_forum_topics' AND COLUMN_NAME = 'author_character_id'
    ) THEN
        ALTER TABLE panel_forum_topics
            ADD COLUMN author_character_id INT UNSIGNED NULL AFTER account_id,
            ADD INDEX idx_topic_author_character (author_character_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panel_forum_posts' AND COLUMN_NAME = 'author_character_id'
    ) THEN
        ALTER TABLE panel_forum_posts
            ADD COLUMN author_character_id INT UNSIGNED NULL AFTER account_id,
            ADD INDEX idx_post_author_character (author_character_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panel_forum_topics' AND COLUMN_NAME = 'created_at_unix'
    ) THEN
        ALTER TABLE panel_forum_topics
            ADD COLUMN created_at_unix INT UNSIGNED NULL AFTER created_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panel_forum_posts' AND COLUMN_NAME = 'created_at_unix'
    ) THEN
        ALTER TABLE panel_forum_posts
            ADD COLUMN created_at_unix INT UNSIGNED NULL AFTER created_at;
    END IF;
END$$

DELIMITER ;

CALL sunset_migrate_forum_author_character();
DROP PROCEDURE IF EXISTS sunset_migrate_forum_author_character;

-- Best-effort backfill from account's earliest character when missing.
UPDATE panel_forum_topics t
SET author_character_id = (
    SELECT MIN(c.id)
    FROM characters c
    INNER JOIN players p ON p.id = c.player_id
    WHERE p.account_id = t.account_id
)
WHERE author_character_id IS NULL;

UPDATE panel_forum_posts p
SET author_character_id = (
    SELECT MIN(c.id)
    FROM characters c
    INNER JOIN players pl ON pl.id = c.player_id
    WHERE pl.account_id = p.account_id
)
WHERE author_character_id IS NULL;

UPDATE panel_forum_topics SET created_at_unix = UNIX_TIMESTAMP(created_at) WHERE created_at_unix IS NULL;
UPDATE panel_forum_posts SET created_at_unix = UNIX_TIMESTAMP(created_at) WHERE created_at_unix IS NULL;
