-- ═══════════════════════════════════════════════════════════════
-- 68-management-expansion.sql
-- Faction/Clan Applications, Management Settings, Questions, Reviews
-- ═══════════════════════════════════════════════════════════════

-- 1. Application Settings for Organizations (Factions & Clans)
CREATE TABLE IF NOT EXISTS `panel_org_application_settings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `org_type` ENUM('faction', 'clan') NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `applications_open` TINYINT(1) NOT NULL DEFAULT 0,
  `min_level` INT NOT NULL DEFAULT 3,
  `min_hours` INT NOT NULL DEFAULT 5,
  `max_warnings` INT NOT NULL DEFAULT 2,
  `cooldown_hours` INT NOT NULL DEFAULT 24,
  `opened_at` DATETIME NULL,
  `opened_by_account_id` INT UNSIGNED NULL,
  `closed_at` DATETIME NULL,
  `closed_by_account_id` INT UNSIGNED NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_org` (`org_type`, `org_id`),
  INDEX `idx_apps_open` (`applications_open`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Configurable Application Questions
CREATE TABLE IF NOT EXISTS `panel_org_application_questions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `org_type` ENUM('faction', 'clan') NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `label_en` VARCHAR(255) NOT NULL,
  `label_ro` VARCHAR(255) NOT NULL,
  `question_type` ENUM('text', 'textarea', 'boolean', 'select') NOT NULL DEFAULT 'text',
  `options_json` TEXT NULL,
  `required` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_org_questions` (`org_type`, `org_id`, `active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Applications
CREATE TABLE IF NOT EXISTS `panel_org_applications` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `org_type` ENUM('faction', 'clan') NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `account_id` INT UNSIGNED NOT NULL,
  `character_id` INT NOT NULL,
  `status` ENUM('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'archived') NOT NULL DEFAULT 'submitted',
  `review_reason` VARCHAR(255) NULL,
  `reviewed_by_account_id` INT UNSIGNED NULL,
  `reviewed_at` DATETIME NULL,
  `snapshot_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_org_status` (`org_type`, `org_id`, `status`),
  INDEX `idx_account_app` (`account_id`, `status`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Application Answers
CREATE TABLE IF NOT EXISTS `panel_org_application_answers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT UNSIGNED NOT NULL,
  `question_id` INT UNSIGNED NOT NULL,
  `answer_text` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_app_id` (`application_id`),
  CONSTRAINT `fk_app_answer` FOREIGN KEY (`application_id`) REFERENCES `panel_org_applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Application Reviews History
CREATE TABLE IF NOT EXISTS `panel_org_application_reviews` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT UNSIGNED NOT NULL,
  `reviewer_account_id` INT UNSIGNED NOT NULL,
  `decision` VARCHAR(32) NOT NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_app_reviews` (`application_id`),
  CONSTRAINT `fk_app_review` FOREIGN KEY (`application_id`) REFERENCES `panel_org_applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Panel Notifications table
CREATE TABLE IF NOT EXISTS `panel_notifications` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `account_id` INT UNSIGNED NOT NULL,
  `type` VARCHAR(48) NOT NULL,
  `title_en` VARCHAR(128) NOT NULL,
  `title_ro` VARCHAR(128) NOT NULL,
  `message_en` VARCHAR(255) NOT NULL,
  `message_ro` VARCHAR(255) NOT NULL,
  `link_url` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_account_read` (`account_id`, `is_read`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
