CREATE TABLE IF NOT EXISTS sanctions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sanction_type ENUM('warning', 'kick', 'ban', 'admin_jail') NOT NULL,
  target_account_id BIGINT UNSIGNED NULL,
  target_username VARCHAR(24) NOT NULL,
  actor_account_id BIGINT UNSIGNED NULL,
  actor_username VARCHAR(24) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  metadata JSON NULL,
  starts_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at TIMESTAMP(6) NULL,
  revoked_at TIMESTAMP(6) NULL,
  revoked_by_account_id BIGINT UNSIGNED NULL,
  revoke_reason VARCHAR(500) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_sanctions_target_history (target_account_id, created_at),
  KEY idx_sanctions_active_ban (target_account_id, sanction_type, revoked_at, expires_at),
  CONSTRAINT fk_sanctions_target FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_sanctions_actor FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_sanctions_revoker FOREIGN KEY (revoked_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sanction_identifiers (
  sanction_id BIGINT UNSIGNED NOT NULL,
  identifier_type VARCHAR(16) NOT NULL,
  identifier_value VARCHAR(191) NOT NULL,
  PRIMARY KEY (sanction_id, identifier_type, identifier_value),
  KEY idx_sanction_identifier_lookup (identifier_type, identifier_value),
  CONSTRAINT fk_sanction_identifiers_sanction FOREIGN KEY (sanction_id) REFERENCES sanctions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  action VARCHAR(64) NOT NULL,
  actor_account_id BIGINT UNSIGNED NULL,
  actor_username VARCHAR(24) NOT NULL,
  target_account_id BIGINT UNSIGNED NULL,
  target_username VARCHAR(24) NULL,
  reason VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_admin_actions_actor (actor_account_id, created_at),
  KEY idx_admin_actions_target (target_account_id, created_at),
  KEY idx_admin_actions_action (action, created_at),
  CONSTRAINT fk_admin_actions_actor FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_admin_actions_target FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

