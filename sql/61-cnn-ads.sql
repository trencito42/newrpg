-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — 61-cnn-ads.sql
--  SA:MP-style CNN Advertisement System & Ad Mutes
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `cnn_ads` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `character_id` INT NOT NULL,
    `player_name` VARCHAR(64) NOT NULL,
    `phone_number` VARCHAR(32) DEFAULT NULL,
    `text` VARCHAR(255) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'published', 'cancelled') NOT NULL DEFAULT 'pending',
    `price_paid` INT UNSIGNED NOT NULL DEFAULT 500,
    `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `scheduled_at` TIMESTAMP NULL DEFAULT NULL,
    `published_at` TIMESTAMP NULL DEFAULT NULL,
    `reviewed_by` VARCHAR(64) DEFAULT NULL,
    `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
    `reject_reason` VARCHAR(255) DEFAULT NULL,
    INDEX `idx_status` (`status`),
    INDEX `idx_character` (`character_id`),
    INDEX `idx_scheduled` (`scheduled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cnn_ad_mutes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `license` VARCHAR(64) NOT NULL,
    `character_id` INT DEFAULT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `banned_by` VARCHAR(64) NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_license` (`license`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
