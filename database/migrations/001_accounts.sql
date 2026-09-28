CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(24) NOT NULL,
  username_normalized VARCHAR(24) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_normalized VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  admin_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('active', 'disabled', 'locked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  last_login_at TIMESTAMP(6) NULL,
  last_seen_at TIMESTAMP(6) NULL,
  login_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_username_normalized (username_normalized),
  UNIQUE KEY uq_accounts_email_normalized (email_normalized),
  CONSTRAINT chk_accounts_admin_level CHECK (admin_level BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

