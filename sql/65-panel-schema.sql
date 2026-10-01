-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — 65-panel-schema.sql
--  Additive schema for official FiveM Companion Web Panel
-- ═══════════════════════════════════════════════════════════════

USE `rpgblipmade`;

-- 1. Web Sessions
CREATE TABLE IF NOT EXISTS `panel_web_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT(10) UNSIGNED NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `selected_character_id` INT(10) UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_active_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NOT NULL,
    `revoked_at` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `uq_panel_session_token` (`token_hash`),
    INDEX `idx_panel_session_acc` (`account_id`),
    INDEX `idx_panel_session_exp` (`expires_at`),
    CONSTRAINT `fk_panel_session_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Web One-Time Link & Login Tokens (for in-game migration and fast login)
CREATE TABLE IF NOT EXISTS `panel_link_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT(10) UNSIGNED NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `code` VARCHAR(8) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NOT NULL,
    `redeemed_at` TIMESTAMP NULL DEFAULT NULL,
    `ip_address` VARCHAR(45) NULL,
    UNIQUE KEY `uq_panel_link_token` (`token`),
    INDEX `idx_panel_link_code` (`code`),
    INDEX `idx_panel_link_acc` (`account_id`),
    CONSTRAINT `fk_panel_link_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Community Polls
CREATE TABLE IF NOT EXISTS `panel_polls` (
    `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `title_en` VARCHAR(191) NOT NULL,
    `title_ro` VARCHAR(191) NOT NULL,
    `description_en` TEXT NULL,
    `description_ro` TEXT NULL,
    `status` ENUM('upcoming', 'active', 'closed', 'archived') NOT NULL DEFAULT 'active',
    `starts_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ends_at` TIMESTAMP NOT NULL,
    `minimum_level` INT(10) UNSIGNED NOT NULL DEFAULT 1,
    `minimum_hours` INT(10) UNSIGNED NOT NULL DEFAULT 0,
    `created_by` INT(10) UNSIGNED NOT NULL,
    `results_visibility` ENUM('public', 'after_vote', 'after_close', 'staff_only') NOT NULL DEFAULT 'public',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_poll_status_ends` (`status`, `ends_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Poll Options
CREATE TABLE IF NOT EXISTS `panel_poll_options` (
    `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `poll_id` INT(10) UNSIGNED NOT NULL,
    `label_en` VARCHAR(191) NOT NULL,
    `label_ro` VARCHAR(191) NOT NULL,
    `sort_order` TINYINT(3) UNSIGNED NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `votes_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
    INDEX `idx_poll_opt_poll` (`poll_id`),
    CONSTRAINT `fk_panel_poll_opt` FOREIGN KEY (`poll_id`) REFERENCES `panel_polls` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Poll Votes (Enforces STRICT One-Vote-Per-Account in Database)
CREATE TABLE IF NOT EXISTS `panel_poll_votes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `poll_id` INT(10) UNSIGNED NOT NULL,
    `option_id` INT(10) UNSIGNED NOT NULL,
    `account_id` INT(10) UNSIGNED NOT NULL,
    `character_id` INT(10) UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_poll_account` (`poll_id`, `account_id`),
    INDEX `idx_vote_option` (`option_id`),
    CONSTRAINT `fk_panel_vote_poll` FOREIGN KEY (`poll_id`) REFERENCES `panel_polls` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_panel_vote_opt` FOREIGN KEY (`option_id`) REFERENCES `panel_poll_options` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_panel_vote_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Support Tickets (Helpdesk - completely separate from police traffic tickets)
CREATE TABLE IF NOT EXISTS `panel_support_tickets` (
    `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT(10) UNSIGNED NOT NULL,
    `character_id` INT(10) UNSIGNED NULL,
    `department` ENUM('general', 'account', 'bug', 'billing', 'faction', 'staff') NOT NULL DEFAULT 'general',
    `subject` VARCHAR(191) NOT NULL,
    `status` ENUM('open', 'in_progress', 'waiting_player', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `assigned_admin_account_id` INT(10) UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `resolved_at` TIMESTAMP NULL DEFAULT NULL,
    INDEX `idx_support_acc_status` (`account_id`, `status`),
    INDEX `idx_support_status_priority` (`status`, `priority`),
    CONSTRAINT `fk_panel_ticket_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Ticket Messages
CREATE TABLE IF NOT EXISTS `panel_ticket_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `ticket_id` INT(10) UNSIGNED NOT NULL,
    `sender_account_id` INT(10) UNSIGNED NOT NULL,
    `sender_character_id` INT(10) UNSIGNED NULL,
    `is_staff` TINYINT(1) NOT NULL DEFAULT 0,
    `message` TEXT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_ticket_msg_ticket` (`ticket_id`),
    CONSTRAINT `fk_panel_msg_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `panel_support_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Player Complaints
CREATE TABLE IF NOT EXISTS `panel_complaints` (
    `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `accuser_account_id` INT(10) UNSIGNED NOT NULL,
    `accuser_character_id` INT(10) UNSIGNED NULL,
    `accused_character_id` INT(10) UNSIGNED NOT NULL,
    `accused_name` VARCHAR(64) NOT NULL,
    `category` ENUM('deathmatch', 'powergaming', 'metagaming', 'insults', 'cheating', 'faction_abuse', 'other') NOT NULL DEFAULT 'other',
    `title` VARCHAR(191) NOT NULL,
    `evidence_text` TEXT NOT NULL,
    `status` ENUM('pending', 'under_review', 'action_taken', 'dismissed') NOT NULL DEFAULT 'pending',
    `verdict` VARCHAR(255) NULL,
    `handled_by_account_id` INT(10) UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_complaints_accuser` (`accuser_account_id`),
    INDEX `idx_complaints_accused` (`accused_character_id`),
    INDEX `idx_complaints_status` (`status`),
    CONSTRAINT `fk_panel_complaint_acc` FOREIGN KEY (`accuser_account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Complaint Messages
CREATE TABLE IF NOT EXISTS `panel_complaint_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `complaint_id` INT(10) UNSIGNED NOT NULL,
    `sender_account_id` INT(10) UNSIGNED NOT NULL,
    `is_staff` TINYINT(1) NOT NULL DEFAULT 0,
    `message` TEXT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_complaint_msg_complaint` (`complaint_id`),
    CONSTRAINT `fk_panel_msg_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `panel_complaints` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Unban Appeals
CREATE TABLE IF NOT EXISTS `panel_unban_requests` (
    `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT(10) UNSIGNED NOT NULL,
    `character_id` INT(10) UNSIGNED NULL,
    `ban_id` INT(10) UNSIGNED NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    `staff_account_id` INT(10) UNSIGNED NULL,
    `staff_response` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `handled_at` TIMESTAMP NULL DEFAULT NULL,
    INDEX `idx_unban_acc` (`account_id`),
    INDEX `idx_unban_status` (`status`),
    CONSTRAINT `fk_panel_unban_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Panel Web Audit Log
CREATE TABLE IF NOT EXISTS `panel_audit_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `actor_account_id` INT(10) UNSIGNED NOT NULL,
    `actor_character_id` INT(10) UNSIGNED NULL,
    `action` VARCHAR(64) NOT NULL,
    `target_entity` VARCHAR(64) NOT NULL,
    `target_id` INT(10) UNSIGNED NULL,
    `reason` VARCHAR(255) NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_panel_audit_actor` (`actor_account_id`),
    INDEX `idx_panel_audit_action` (`action`),
    INDEX `idx_panel_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Panel Materialized Stat Snapshots (Prevents Expensive Aggregate Scans)
CREATE TABLE IF NOT EXISTS `panel_stat_snapshots` (
    `metric_key` VARCHAR(64) NOT NULL PRIMARY KEY,
    `metric_value` JSON NOT NULL,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Panel User Preferences
CREATE TABLE IF NOT EXISTS `panel_preferences` (
    `account_id` INT(10) UNSIGNED NOT NULL PRIMARY KEY,
    `theme` VARCHAR(16) NOT NULL DEFAULT 'dark',
    `locale` VARCHAR(8) NOT NULL DEFAULT 'en',
    `sidebar_collapsed` TINYINT(1) NOT NULL DEFAULT 0,
    `email_notifications` TINYINT(1) NOT NULL DEFAULT 1,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_panel_pref_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed an initial active community poll for mayoral election
INSERT IGNORE INTO `panel_polls` (`id`, `title_en`, `title_ro`, `description_en`, `description_ro`, `status`, `starts_at`, `ends_at`, `minimum_level`, `minimum_hours`, `created_by`) VALUES
(1, 'Mayor Election — October 2026', 'Alegeri Primar — Octombrie 2026', 'Vote for the upcoming Los Santos City Mayor for the October 2026 mandate. Minimum character level 3 required.', 'Votează viitorul Primar al orașului Los Santos pentru mandatul Octombrie 2026. Este necesar minim nivelul 3 de caracter.', 'active', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), 3, 5, 1);

INSERT IGNORE INTO `panel_poll_options` (`id`, `poll_id`, `label_en`, `label_ro`, `sort_order`, `votes_count`) VALUES
(1, 1, 'Marcus Vance (Civic Liberty Party)', 'Marcus Vance (Partidul Libertății Civice)', 1, 0),
(2, 1, 'Elena Rostova (Progress & Industry)', 'Elena Rostova (Progres & Industrie)', 2, 0),
(3, 1, 'Darius King (Independent Reform)', 'Darius King (Reformă Independentă)', 3, 0);
