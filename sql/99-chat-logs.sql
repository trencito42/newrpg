-- 99-chat-logs.sql
-- Player chat moderation log (owned by sunset_chat — only that resource INSERTs).

CREATE TABLE IF NOT EXISTS `chat_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `character_id` INT UNSIGNED NOT NULL,
    `account_id` INT UNSIGNED NULL DEFAULT NULL,
    `player_name_snapshot` VARCHAR(128) NOT NULL,
    `message` TEXT NOT NULL,
    `channel_type` VARCHAR(32) NOT NULL,
    `faction_id` VARCHAR(64) NULL DEFAULT NULL,
    `clan_id` INT UNSIGNED NULL DEFAULT NULL,
    `target_character_id` INT UNSIGNED NULL DEFAULT NULL,
    `target_name_snapshot` VARCHAR(128) NULL DEFAULT NULL,
    `status` ENUM('sent', 'blocked') NOT NULL DEFAULT 'sent',
    `metadata` JSON NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_chat_logs_character_created` (`character_id`, `created_at`),
    INDEX `idx_chat_logs_channel_created` (`channel_type`, `created_at`),
    INDEX `idx_chat_logs_target_created` (`target_character_id`, `created_at`),
    INDEX `idx_chat_logs_created` (`created_at`),
    FULLTEXT INDEX `ft_chat_logs_message` (`message`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
