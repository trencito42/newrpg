-- Live online player roster for the companion panel (written by sunset_panel_bridge).
CREATE TABLE IF NOT EXISTS `panel_online_roster` (
  `character_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `level` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `job` VARCHAR(64) NOT NULL DEFAULT 'unemployed',
  `faction_id` VARCHAR(32) NULL,
  `paydays_received` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `skin` VARCHAR(64) NULL,
  PRIMARY KEY (`character_id`),
  KEY `idx_panel_online_roster_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
