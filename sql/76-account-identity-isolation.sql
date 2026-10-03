-- Account identity isolation hardening.
--
-- Preflight: run scripts/account-identity-audit.sql before this migration. The
-- unique account index intentionally refuses to install while duplicate player
-- profiles exist, so ambiguous ownership is never merged or deleted silently.

SET @schema_name = DATABASE();

SET @drop_license_unique = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE players DROP INDEX license',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'players'
      AND index_name = 'license'
      AND non_unique = 0
);
PREPARE identity_stmt FROM @drop_license_unique;
EXECUTE identity_stmt;
DEALLOCATE PREPARE identity_stmt;

SET @add_license_index = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE players ADD KEY idx_players_license (license)',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'players'
      AND index_name = 'idx_players_license'
);
PREPARE identity_stmt FROM @add_license_index;
EXECUTE identity_stmt;
DEALLOCATE PREPARE identity_stmt;

-- NULL remains temporarily valid for legacy rows pending manual reconciliation.
-- Non-NULL account ownership is strictly one account to one player profile.
SET @add_account_unique = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE players ADD UNIQUE KEY uq_players_account_id (account_id)',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'players'
      AND index_name = 'uq_players_account_id'
);
PREPARE identity_stmt FROM @add_account_unique;
EXECUTE identity_stmt;
DEALLOCATE PREPARE identity_stmt;

CREATE TABLE IF NOT EXISTS account_identifiers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id INT UNSIGNED NOT NULL,
    identifier_type VARCHAR(24) NOT NULL,
    identifier_value VARCHAR(128) NOT NULL,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSON NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_account_identifier (account_id, identifier_type, identifier_value),
    KEY idx_identifier_lookup (identifier_type, identifier_value),
    CONSTRAINT fk_account_identifier_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Capture current device metadata without making it an ownership key. The same
-- identifier may legitimately appear for more than one account.
INSERT IGNORE INTO account_identifiers
    (account_id, identifier_type, identifier_value, first_seen_at, last_seen_at)
SELECT account_id, 'license', license, created_at, last_seen
FROM players
WHERE account_id IS NOT NULL AND license IS NOT NULL AND license <> '';
