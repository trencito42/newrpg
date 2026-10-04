-- Single-use upload ledger shared by the game server and racket.cat.
-- The raw token is never stored. Only its SHA-256 hex digest is.

CREATE TABLE IF NOT EXISTS media_upload_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_hash CHAR(64) NOT NULL,
    account_id INT UNSIGNED NULL,
    character_id INT UNSIGNED NOT NULL,
    media_type VARCHAR(32) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    expires_at DATETIME NOT NULL,
    uploaded_at DATETIME NULL,
    committed_at DATETIME NULL,
    media_url VARCHAR(512) NULL,
    mime_type VARCHAR(64) NULL,
    file_size INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_media_upload_token_hash (token_hash),
    KEY idx_media_upload_character (character_id, media_type, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
