CREATE TABLE IF NOT EXISTS players (
  account_id BIGINT UNSIGNED NOT NULL,
  sex ENUM('male', 'female') NOT NULL,
  model VARCHAR(64) NOT NULL,
  tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_x DECIMAL(11,6) NOT NULL DEFAULT -1037.74,
  last_y DECIMAL(11,6) NOT NULL DEFAULT -2737.82,
  last_z DECIMAL(11,6) NOT NULL DEFAULT 20.17,
  last_heading DECIMAL(8,4) NOT NULL DEFAULT 329.0,
  health SMALLINT UNSIGNED NOT NULL DEFAULT 200,
  armor SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_dead BOOLEAN NOT NULL DEFAULT FALSE,
  level INT UNSIGNED NOT NULL DEFAULT 1,
  xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_playtime_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (account_id),
  CONSTRAINT fk_players_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT chk_players_health CHECK (health <= 200),
  CONSTRAINT chk_players_armor CHECK (armor <= 100),
  CONSTRAINT chk_players_level CHECK (level >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_identifiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL,
  identifier_type ENUM('license', 'license2', 'fivem', 'discord', 'steam', 'ip') NOT NULL,
  identifier_value VARCHAR(191) NOT NULL,
  first_seen_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_account_identifier (account_id, identifier_type, identifier_value),
  KEY idx_identifier_lookup (identifier_type, identifier_value),
  CONSTRAINT fk_identifiers_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

