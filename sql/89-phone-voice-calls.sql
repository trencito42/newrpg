-- Optional voice on an active phone call. Text chat through the call stays available either way.
-- Idempotent: the column is added only when it is missing. Default is on.

DELIMITER $$

DROP PROCEDURE IF EXISTS sunset_migrate_phone_voice_calls$$
CREATE PROCEDURE sunset_migrate_phone_voice_calls()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'phone_character_prefs'
          AND COLUMN_NAME = 'voice_calls'
    ) THEN
        ALTER TABLE `phone_character_prefs`
            ADD COLUMN `voice_calls` TINYINT(1) NOT NULL DEFAULT 1;
    END IF;
END$$

DELIMITER ;

CALL sunset_migrate_phone_voice_calls();
DROP PROCEDURE IF EXISTS sunset_migrate_phone_voice_calls;
