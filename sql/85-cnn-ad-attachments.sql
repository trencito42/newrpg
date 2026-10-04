-- Optional structured reference for a CNN ad. The server writes these columns
-- after it resolves the asset. Client JSON is never stored as trusted detail.
DELIMITER $$

DROP PROCEDURE IF EXISTS sunset_migrate_cnn_ad_attachments$$
CREATE PROCEDURE sunset_migrate_cnn_ad_attachments()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cnn_ads' AND COLUMN_NAME = 'attachment_type'
    ) THEN
        ALTER TABLE `cnn_ads` ADD COLUMN `attachment_type` VARCHAR(16) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cnn_ads' AND COLUMN_NAME = 'attachment_id'
    ) THEN
        ALTER TABLE `cnn_ads` ADD COLUMN `attachment_id` VARCHAR(64) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cnn_ads' AND COLUMN_NAME = 'market_listing_id'
    ) THEN
        ALTER TABLE `cnn_ads` ADD COLUMN `market_listing_id` INT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cnn_ads' AND COLUMN_NAME = 'attachment_snapshot'
    ) THEN
        ALTER TABLE `cnn_ads` ADD COLUMN `attachment_snapshot` TEXT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cnn_ads' AND INDEX_NAME = 'idx_cnn_listing'
    ) THEN
        ALTER TABLE `cnn_ads` ADD INDEX `idx_cnn_listing` (`market_listing_id`);
    END IF;
END$$

DELIMITER ;

CALL sunset_migrate_cnn_ad_attachments();
DROP PROCEDURE IF EXISTS sunset_migrate_cnn_ad_attachments;
