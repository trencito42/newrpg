-- 72-threads-and-applications.sql
-- Discussion threads, comments, and PRO/CONTRA voting for applications and complaints.

CREATE TABLE IF NOT EXISTS panel_org_application_comments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL,
  org_type ENUM('faction', 'clan') NOT NULL,
  org_id VARCHAR(64) NOT NULL,
  sender_account_id INT UNSIGNED NOT NULL,
  sender_character_id INT UNSIGNED NULL,
  sender_username VARCHAR(64) NOT NULL,
  role_badge VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_app_id (application_id),
  INDEX idx_sender (sender_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_org_application_votes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL,
  org_type ENUM('faction', 'clan') NOT NULL,
  org_id VARCHAR(64) NOT NULL,
  voter_account_id INT UNSIGNED NOT NULL,
  voter_character_id INT UNSIGNED NULL,
  voter_username VARCHAR(64) NOT NULL,
  vote ENUM('pro', 'contra', 'neutral') NOT NULL,
  comment VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_app_voter (application_id, voter_account_id),
  INDEX idx_app (application_id),
  INDEX idx_voter (voter_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
