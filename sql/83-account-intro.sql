-- One server presentation per account. Not per login and not per character.
-- Idempotent. Does not delete accounts or characters.

CREATE TABLE IF NOT EXISTS `account_intro_seen` (
    `account_id` INT UNSIGNED NOT NULL,
    `seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
