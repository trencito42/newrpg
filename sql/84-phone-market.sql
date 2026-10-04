-- Player marketplace listings. Asset rows stay in their own tables; this stores the offer only.
CREATE TABLE IF NOT EXISTS `phone_market_listings` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `seller_character_id` INT UNSIGNED NOT NULL,
    `listing_type` ENUM('vehicle', 'item', 'property') NOT NULL,
    `asset_id` VARCHAR(64) NOT NULL,
    `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
    `asking_price` INT UNSIGNED NOT NULL,
    `status` ENUM('active', 'sold', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL DEFAULT NULL,
    `buyer_character_id` INT UNSIGNED NULL DEFAULT NULL,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_market_browse` (`status`, `listing_type`, `id`),
    KEY `idx_market_seller` (`seller_character_id`, `status`),
    KEY `idx_market_asset` (`listing_type`, `asset_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_character_prefs` (
    `character_id` INT UNSIGNED NOT NULL,
    `ringtone` TINYINT(1) NOT NULL DEFAULT 1,
    `notify_sound` TINYINT(1) NOT NULL DEFAULT 1,
    `compact_notes` TINYINT(1) NOT NULL DEFAULT 0,
    `layout` VARCHAR(512) NULL DEFAULT NULL,
    PRIMARY KEY (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
