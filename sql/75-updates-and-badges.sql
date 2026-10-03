-- 75: Updates/News/Blog system and Custom Profile Badges

ALTER TABLE `accounts` 
  ADD COLUMN IF NOT EXISTS `is_author` TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `panel_updates` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(128) NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `summary` TEXT NULL,
  `content` MEDIUMTEXT NOT NULL,
  `category` VARCHAR(32) NOT NULL DEFAULT 'update',
  `author_account_id` INT NOT NULL,
  `author_name` VARCHAR(64) NOT NULL,
  `cover_image` VARCHAR(255) NULL,
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `views_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `published_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_published` (`published_at`),
  INDEX `idx_category` (`category`),
  INDEX `idx_author` (`author_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `account_badges` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `account_id` INT NOT NULL,
  `badge_key` VARCHAR(64) NOT NULL,
  `title` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NULL,
  `icon` VARCHAR(32) NOT NULL DEFAULT 'Award',
  `color` VARCHAR(32) NOT NULL DEFAULT '#D7B558',
  `bg_color` VARCHAR(32) NOT NULL DEFAULT 'rgba(215, 181, 88, 0.15)',
  `assigned_by` VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_account_badge` (`account_id`, `badge_key`),
  INDEX `idx_account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
