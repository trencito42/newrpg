-- Code-point offset of a CNN ad attachment inside cnn_ads.text, after /ad is stripped.
DELIMITER $$

DROP PROCEDURE IF EXISTS sunset_migrate_cnn_ad_attachment_index$$
CREATE PROCEDURE sunset_migrate_cnn_ad_attachment_index()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cnn_ads' AND COLUMN_NAME = 'attachment_index'
    ) THEN
        ALTER TABLE `cnn_ads` ADD COLUMN `attachment_index` INT NULL;
    END IF;
END$$

DELIMITER ;

CALL sunset_migrate_cnn_ad_attachment_index();
DROP PROCEDURE IF EXISTS sunset_migrate_cnn_ad_attachment_index;
