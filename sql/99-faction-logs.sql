-- Structured faction activity log (RACKET panel Logs tab).
-- Replaces faction_audit_log as the single source of truth.

CREATE TABLE IF NOT EXISTS `faction_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faction_id` VARCHAR(32) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `actor_character_id` INT UNSIGNED NULL,
    `target_character_id` INT UNSIGNED NULL,
    `actor_name_snapshot` VARCHAR(128) NULL,
    `target_name_snapshot` VARCHAR(128) NULL,
    `previous_value` VARCHAR(256) NULL,
    `new_value` VARCHAR(256) NULL,
    `reason` VARCHAR(512) NULL,
    `metadata` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_faction_created` (`faction_id`, `created_at`),
    KEY `idx_faction_event` (`faction_id`, `event_type`),
    KEY `idx_target_created` (`target_character_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `faction_logs` (
    `faction_id`,
    `event_type`,
    `actor_character_id`,
    `target_character_id`,
    `metadata`,
    `created_at`
)
SELECT
    `faction_id`,
    `action`,
    `actor_character_id`,
    `target_character_id`,
    `details`,
    `created_at`
FROM `faction_audit_log`;

DROP TABLE IF EXISTS `faction_audit_log`;
