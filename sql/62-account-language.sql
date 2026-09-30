-- Per-account language preference. Internal values remain stable locale codes;
-- translated labels are never persisted or used as game logic.
ALTER TABLE `accounts`
    ADD COLUMN IF NOT EXISTS `language` VARCHAR(8) NOT NULL DEFAULT 'en' AFTER `email`;

UPDATE `accounts`
SET `language` = 'en'
WHERE `language` IS NULL OR `language` NOT IN ('en', 'ro');
