-- Panel-owned public organization profiles (cover, optional description override, rules)
CREATE TABLE IF NOT EXISTS `panel_org_profiles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `org_type` ENUM('faction', 'clan') NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `cover_image` VARCHAR(512) NULL,
  `description_en` TEXT NULL,
  `description_ro` TEXT NULL,
  `rules_en` MEDIUMTEXT NULL,
  `rules_ro` MEDIUMTEXT NULL,
  `updated_by_account_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_profile` (`org_type`, `org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
