ALTER TABLE accounts DROP CONSTRAINT chk_accounts_admin_level;
ALTER TABLE accounts
  MODIFY admin_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN helper_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER admin_level,
  ADD CONSTRAINT chk_accounts_admin_level CHECK (admin_level BETWEEN 0 AND 6),
  ADD CONSTRAINT chk_accounts_helper_level CHECK (helper_level BETWEEN 0 AND 3);

-- Level 5 was the former Owner rank; preserve its authority in the new 1-6 scale.
UPDATE accounts SET admin_level = 6 WHERE admin_level = 5;

ALTER TABLE sanctions MODIFY sanction_type
  ENUM('warning', 'kick', 'ban', 'ip_ban', 'mute', 'newbie_mute', 'admin_jail') NOT NULL;

CREATE TABLE factions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  name_normalized VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_factions_name (name_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE players
  ADD COLUMN money BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER xp,
  ADD COLUMN respect_points BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER money,
  ADD COLUMN faction_id BIGINT UNSIGNED NULL AFTER respect_points,
  ADD COLUMN faction_leader BOOLEAN NOT NULL DEFAULT FALSE AFTER faction_id,
  ADD CONSTRAINT fk_players_faction FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE SET NULL;

CREATE TABLE player_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_account_id BIGINT UNSIGNED NULL,
  reporter_username VARCHAR(24) NOT NULL,
  reporter_source INT UNSIGNED NOT NULL,
  message VARCHAR(500) NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  closed_by_account_id BIGINT UNSIGNED NULL,
  closed_by_username VARCHAR(24) NULL,
  close_reason VARCHAR(500) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  closed_at TIMESTAMP(6) NULL,
  PRIMARY KEY (id),
  KEY idx_reports_status_created (status, created_at),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_closer FOREIGN KEY (closed_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE newbie_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  asker_account_id BIGINT UNSIGNED NULL,
  asker_username VARCHAR(24) NOT NULL,
  asker_source INT UNSIGNED NOT NULL,
  question VARCHAR(500) NOT NULL,
  status ENUM('open', 'answered', 'deleted') NOT NULL DEFAULT 'open',
  handled_by_account_id BIGINT UNSIGNED NULL,
  handled_by_username VARCHAR(24) NULL,
  answer VARCHAR(500) NULL,
  close_reason VARCHAR(500) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  handled_at TIMESTAMP(6) NULL,
  PRIMARY KEY (id),
  KEY idx_questions_status_created (status, created_at),
  CONSTRAINT fk_questions_asker FOREIGN KEY (asker_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_questions_handler FOREIGN KEY (handled_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE houses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level TINYINT UNSIGNED NOT NULL,
  price BIGINT UNSIGNED NOT NULL,
  x DECIMAL(11,6) NOT NULL,
  y DECIMAL(11,6) NOT NULL,
  z DECIMAL(11,6) NOT NULL,
  heading DECIMAL(8,4) NOT NULL,
  virtual_world INT UNSIGNED NOT NULL DEFAULT 0,
  owner_account_id BIGINT UNSIGNED NULL,
  created_by_account_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_houses_owner (owner_account_id),
  CONSTRAINT fk_houses_owner FOREIGN KEY (owner_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_houses_creator FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT chk_houses_level CHECK (level BETWEEN 1 AND 10),
  CONSTRAINT chk_houses_price CHECK (price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE server_vehicles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  model VARCHAR(64) NOT NULL,
  x DECIMAL(11,6) NOT NULL,
  y DECIMAL(11,6) NOT NULL,
  z DECIMAL(11,6) NOT NULL,
  heading DECIMAL(8,4) NOT NULL,
  virtual_world INT UNSIGNED NOT NULL DEFAULT 0,
  created_by_account_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_server_vehicles_creator FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
