CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  server_source INT UNSIGNED NOT NULL,
  started_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  authenticated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_activity_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ended_at TIMESTAMP(6) NULL,
  end_reason VARCHAR(191) NULL,
  playtime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  active_account_id BIGINT UNSIGNED GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NULL THEN account_id ELSE NULL END
  ) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_one_active_session_per_account (active_account_id),
  KEY idx_sessions_account_started (account_id, started_at),
  KEY idx_sessions_active (ended_at, last_activity_at),
  CONSTRAINT fk_sessions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

