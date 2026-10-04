-- Missed-call badge clears after the player opens Recents.
-- Idempotent: the column is added only when it is missing.

DELIMITER $$

DROP PROCEDURE IF EXISTS sunset_migrate_phone_calls_seen$$
CREATE PROCEDURE sunset_migrate_phone_calls_seen()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'phone_character_prefs'
          AND COLUMN_NAME = 'calls_seen_id'
    ) THEN
        ALTER TABLE `phone_character_prefs`
            ADD COLUMN `calls_seen_id` INT UNSIGNED NOT NULL DEFAULT 0;
    END IF;
END$$

DELIMITER ;

CALL sunset_migrate_phone_calls_seen();
DROP PROCEDURE IF EXISTS sunset_migrate_phone_calls_seen;
