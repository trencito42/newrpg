-- ═══════════════════════════════════════════════════════════════
-- 74: Password Reset Tokens
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `account_password_resets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_reset_token` (`token_hash`),
  KEY `idx_password_reset_account` (`account_id`),
  KEY `idx_password_reset_expires` (`expires_at`),
  CONSTRAINT `fk_password_reset_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
