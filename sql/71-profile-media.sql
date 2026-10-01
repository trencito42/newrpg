-- Migration 71: Profile Media (Skin snapshots, vehicle previews & featured vehicle)

CREATE TABLE IF NOT EXISTS panel_player_media (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  avatar_url VARCHAR(255) NOT NULL,
  avatar_hash VARCHAR(64) NOT NULL,
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_player_media_hash (avatar_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_vehicle_media (
  vehicle_id INT UNSIGNED NOT NULL PRIMARY KEY,
  preview_url VARCHAR(255) NOT NULL,
  visual_hash VARCHAR(64) NOT NULL,
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vehicle_media_hash (visual_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE panel_preferences
  ADD COLUMN IF NOT EXISTS featured_vehicle_id INT UNSIGNED NULL DEFAULT NULL;
