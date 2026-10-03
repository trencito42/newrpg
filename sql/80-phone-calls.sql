-- 80-phone-calls.sql
-- Call history for the in-game phone. Safe to re-run.

CREATE TABLE IF NOT EXISTS `phone_calls` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `caller_character_id` INT UNSIGNED NOT NULL,
    `callee_character_id` INT UNSIGNED NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `duration_seconds` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_phone_calls_caller` (`caller_character_id`, `id`),
    KEY `idx_phone_calls_callee` (`callee_character_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
