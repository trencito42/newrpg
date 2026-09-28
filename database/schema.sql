/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;
DROP TABLE IF EXISTS `account_identifiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_identifiers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `account_id` bigint(20) unsigned NOT NULL,
  `identifier_type` enum('license','license2','fivem','discord','steam','ip') NOT NULL,
  `identifier_value` varchar(191) NOT NULL,
  `first_seen_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `last_seen_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_identifier` (`account_id`,`identifier_type`,`identifier_value`),
  KEY `idx_identifier_lookup` (`identifier_type`,`identifier_value`),
  CONSTRAINT `fk_identifiers_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(24) NOT NULL,
  `username_normalized` varchar(24) NOT NULL,
  `email` varchar(254) NOT NULL,
  `email_normalized` varchar(254) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `admin_level` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `helper_level` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `status` enum('active','disabled','locked') NOT NULL DEFAULT 'active',
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `last_login_at` timestamp(6) NULL DEFAULT NULL,
  `last_seen_at` timestamp(6) NULL DEFAULT NULL,
  `login_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_username_normalized` (`username_normalized`),
  UNIQUE KEY `uq_accounts_email_normalized` (`email_normalized`),
  CONSTRAINT `chk_accounts_admin_level` CHECK (`admin_level` between 0 and 6),
  CONSTRAINT `chk_accounts_helper_level` CHECK (`helper_level` between 0 and 3)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `admin_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_actions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `action` varchar(64) NOT NULL,
  `actor_account_id` bigint(20) unsigned DEFAULT NULL,
  `actor_username` varchar(24) NOT NULL,
  `target_account_id` bigint(20) unsigned DEFAULT NULL,
  `target_username` varchar(24) DEFAULT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `idx_admin_actions_actor` (`actor_account_id`,`created_at`),
  KEY `idx_admin_actions_target` (`target_account_id`,`created_at`),
  KEY `idx_admin_actions_action` (`action`,`created_at`),
  CONSTRAINT `fk_admin_actions_actor` FOREIGN KEY (`actor_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_admin_actions_target` FOREIGN KEY (`target_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `factions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `factions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `name_normalized` varchar(64) NOT NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_factions_name` (`name_normalized`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `houses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `houses` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `level` tinyint(3) unsigned NOT NULL,
  `price` bigint(20) unsigned NOT NULL,
  `x` decimal(11,6) NOT NULL,
  `y` decimal(11,6) NOT NULL,
  `z` decimal(11,6) NOT NULL,
  `heading` decimal(8,4) NOT NULL,
  `virtual_world` int(10) unsigned NOT NULL DEFAULT 0,
  `owner_account_id` bigint(20) unsigned DEFAULT NULL,
  `created_by_account_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `idx_houses_owner` (`owner_account_id`),
  KEY `fk_houses_creator` (`created_by_account_id`),
  CONSTRAINT `fk_houses_creator` FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_houses_owner` FOREIGN KEY (`owner_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_houses_level` CHECK (`level` between 1 and 10),
  CONSTRAINT `chk_houses_price` CHECK (`price` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `newbie_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `newbie_questions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `asker_account_id` bigint(20) unsigned DEFAULT NULL,
  `asker_username` varchar(24) NOT NULL,
  `asker_source` int(10) unsigned NOT NULL,
  `question` varchar(500) NOT NULL,
  `status` enum('open','answered','deleted') NOT NULL DEFAULT 'open',
  `handled_by_account_id` bigint(20) unsigned DEFAULT NULL,
  `handled_by_username` varchar(24) DEFAULT NULL,
  `answer` varchar(500) DEFAULT NULL,
  `close_reason` varchar(500) DEFAULT NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `handled_at` timestamp(6) NULL DEFAULT NULL,
  `open_asker_account_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_one_open_question_per_account` (`open_asker_account_id`),
  KEY `idx_questions_status_created` (`status`,`created_at`),
  KEY `fk_questions_asker` (`asker_account_id`),
  KEY `fk_questions_handler` (`handled_by_account_id`),
  CONSTRAINT `fk_questions_asker` FOREIGN KEY (`asker_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_questions_handler` FOREIGN KEY (`handled_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `player_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_reports` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `reporter_account_id` bigint(20) unsigned DEFAULT NULL,
  `reporter_username` varchar(24) NOT NULL,
  `reporter_source` int(10) unsigned NOT NULL,
  `message` varchar(500) NOT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `closed_by_account_id` bigint(20) unsigned DEFAULT NULL,
  `closed_by_username` varchar(24) DEFAULT NULL,
  `close_reason` varchar(500) DEFAULT NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `closed_at` timestamp(6) NULL DEFAULT NULL,
  `open_reporter_account_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_one_open_report_per_account` (`open_reporter_account_id`),
  KEY `idx_reports_status_created` (`status`,`created_at`),
  KEY `fk_reports_reporter` (`reporter_account_id`),
  KEY `fk_reports_closer` (`closed_by_account_id`),
  CONSTRAINT `fk_reports_closer` FOREIGN KEY (`closed_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reports_reporter` FOREIGN KEY (`reporter_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `players` (
  `account_id` bigint(20) unsigned NOT NULL,
  `sex` enum('male','female') NOT NULL,
  `model` varchar(64) NOT NULL,
  `tutorial_completed` tinyint(1) NOT NULL DEFAULT 0,
  `last_x` decimal(11,6) NOT NULL DEFAULT -1037.740000,
  `last_y` decimal(11,6) NOT NULL DEFAULT -2737.820000,
  `last_z` decimal(11,6) NOT NULL DEFAULT 20.170000,
  `last_heading` decimal(8,4) NOT NULL DEFAULT 329.0000,
  `health` smallint(5) unsigned NOT NULL DEFAULT 200,
  `armor` smallint(5) unsigned NOT NULL DEFAULT 0,
  `is_dead` tinyint(1) NOT NULL DEFAULT 0,
  `level` int(10) unsigned NOT NULL DEFAULT 1,
  `xp` bigint(20) unsigned NOT NULL DEFAULT 0,
  `money` bigint(20) unsigned NOT NULL DEFAULT 0,
  `respect_points` bigint(20) unsigned NOT NULL DEFAULT 0,
  `faction_id` bigint(20) unsigned DEFAULT NULL,
  `faction_leader` tinyint(1) NOT NULL DEFAULT 0,
  `total_playtime_seconds` bigint(20) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`account_id`),
  KEY `fk_players_faction` (`faction_id`),
  CONSTRAINT `fk_players_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_players_faction` FOREIGN KEY (`faction_id`) REFERENCES `factions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_players_health` CHECK (`health` <= 200),
  CONSTRAINT `chk_players_armor` CHECK (`armor` <= 100),
  CONSTRAINT `chk_players_level` CHECK (`level` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sanction_identifiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sanction_identifiers` (
  `sanction_id` bigint(20) unsigned NOT NULL,
  `identifier_type` varchar(16) NOT NULL,
  `identifier_value` varchar(191) NOT NULL,
  PRIMARY KEY (`sanction_id`,`identifier_type`,`identifier_value`),
  KEY `idx_sanction_identifier_lookup` (`identifier_type`,`identifier_value`),
  CONSTRAINT `fk_sanction_identifiers_sanction` FOREIGN KEY (`sanction_id`) REFERENCES `sanctions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sanctions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sanctions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sanction_type` enum('warning','kick','ban','ip_ban','mute','newbie_mute','admin_jail') NOT NULL,
  `target_account_id` bigint(20) unsigned DEFAULT NULL,
  `target_username` varchar(24) NOT NULL,
  `actor_account_id` bigint(20) unsigned DEFAULT NULL,
  `actor_username` varchar(24) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `starts_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `expires_at` timestamp(6) NULL DEFAULT NULL,
  `revoked_at` timestamp(6) NULL DEFAULT NULL,
  `revoked_by_account_id` bigint(20) unsigned DEFAULT NULL,
  `consumed_by_sanction_id` bigint(20) unsigned DEFAULT NULL,
  `resolved_at` timestamp(6) NULL DEFAULT NULL,
  `revoke_reason` varchar(500) DEFAULT NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `idx_sanctions_target_history` (`target_account_id`,`created_at`),
  KEY `idx_sanctions_active_ban` (`target_account_id`,`sanction_type`,`revoked_at`,`expires_at`),
  KEY `fk_sanctions_actor` (`actor_account_id`),
  KEY `fk_sanctions_revoker` (`revoked_by_account_id`),
  KEY `fk_sanctions_consumed_by` (`consumed_by_sanction_id`),
  KEY `idx_sanctions_active_warning` (`target_account_id`,`sanction_type`,`revoked_at`,`consumed_by_sanction_id`,`expires_at`),
  CONSTRAINT `fk_sanctions_actor` FOREIGN KEY (`actor_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sanctions_consumed_by` FOREIGN KEY (`consumed_by_sanction_id`) REFERENCES `sanctions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sanctions_revoker` FOREIGN KEY (`revoked_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sanctions_target` FOREIGN KEY (`target_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `version` varchar(64) NOT NULL,
  `checksum` char(64) NOT NULL,
  `applied_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `server_vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `server_vehicles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `model` varchar(64) NOT NULL,
  `x` decimal(11,6) NOT NULL,
  `y` decimal(11,6) NOT NULL,
  `z` decimal(11,6) NOT NULL,
  `heading` decimal(8,4) NOT NULL,
  `virtual_world` int(10) unsigned NOT NULL DEFAULT 0,
  `created_by_account_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `fk_server_vehicles_creator` (`created_by_account_id`),
  CONSTRAINT `fk_server_vehicles_creator` FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` char(36) NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `server_source` int(10) unsigned NOT NULL,
  `started_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `authenticated_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `last_activity_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `ended_at` timestamp(6) NULL DEFAULT NULL,
  `end_reason` varchar(191) DEFAULT NULL,
  `playtime_seconds` int(10) unsigned NOT NULL DEFAULT 0,
  `active_account_id` bigint(20) unsigned GENERATED ALWAYS AS (case when `ended_at` is null then `account_id` else NULL end) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_one_active_session_per_account` (`active_account_id`),
  KEY `idx_sessions_account_started` (`account_id`,`started_at`),
  KEY `idx_sessions_active` (`ended_at`,`last_activity_at`),
  CONSTRAINT `fk_sessions_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

