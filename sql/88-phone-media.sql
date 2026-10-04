-- Phone photos and structured SMS attachments.
-- Image bytes stay on the media host. These tables store references only.

CREATE TABLE IF NOT EXISTS phone_media (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_id INT UNSIGNED NOT NULL,
    media_type VARCHAR(32) NOT NULL,
    url VARCHAR(512) NOT NULL,
    thumbnail_url VARCHAR(512) NULL,
    mime_type VARCHAR(64) NULL,
    width INT NULL,
    height INT NULL,
    file_size INT UNSIGNED NULL,
    source_media_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_phone_media_owner (character_id, created_at),
    KEY idx_phone_media_source (source_media_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS phone_gallery (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_id INT UNSIGNED NOT NULL,
    media_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_gallery_char_media (character_id, media_id),
    KEY idx_gallery_char_created (character_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS sunset_migrate_phone_message_attachments$$
CREATE PROCEDURE sunset_migrate_phone_message_attachments()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phone_messages' AND COLUMN_NAME = 'attachment_type'
    ) THEN
        ALTER TABLE phone_messages ADD COLUMN attachment_type VARCHAR(16) NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phone_messages' AND COLUMN_NAME = 'attachment_id'
    ) THEN
        ALTER TABLE phone_messages ADD COLUMN attachment_id INT UNSIGNED NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phone_messages' AND COLUMN_NAME = 'attachment_snapshot'
    ) THEN
        ALTER TABLE phone_messages ADD COLUMN attachment_snapshot TEXT NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phone_messages' AND INDEX_NAME = 'idx_phone_messages_attachment'
    ) THEN
        ALTER TABLE phone_messages ADD INDEX idx_phone_messages_attachment (attachment_id);
    END IF;
END$$

DELIMITER ;

CALL sunset_migrate_phone_message_attachments();
DROP PROCEDURE IF EXISTS sunset_migrate_phone_message_attachments;
