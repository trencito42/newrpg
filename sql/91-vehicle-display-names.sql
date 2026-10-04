-- Presentation-only vehicle identity catalog.
-- Kept separate from dealership_vehicles because dealership price/availability
-- are gameplay/economy data and must not be invented for streamed pack cars.

CREATE TABLE IF NOT EXISTS `vehicle_display_names` (
    `model` VARCHAR(64) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `brand` VARCHAR(48) DEFAULT NULL,
    `source` VARCHAR(32) NOT NULL DEFAULT 'streamed_catalog',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`model`),
    KEY `brand` (`brand`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
