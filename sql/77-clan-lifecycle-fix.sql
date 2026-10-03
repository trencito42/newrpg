-- ═══════════════════════════════════════════════════════════════
--  77-clan-lifecycle-fix.sql
--  Repair legacy clan expiry produced by 76-clan-lifecycle.sql.
--
--  76 backfilled `expires_at = created_at + 30 days`, so every clan older
--  than 30 days was born already expired and the lifecycle ticker moved it
--  to grace/expired on the first tick. This one-shot repair grants every
--  lapsed (or still NULL) clan a fresh 30-day lifetime from NOW and restores
--  the active status. A valid future expiry is never shortened.
--
--  Idempotent: docker/fivem/entrypoint.sh re-imports every migration on each
--  container start, so the repair is guarded by a data-fix marker row. Without
--  the marker, every restart would silently renew genuinely lapsed clans.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `schema_data_fixes` (
  `name` VARCHAR(191) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE `clans`
SET `expires_at` = GREATEST(IFNULL(`expires_at`, NOW()), NOW() + INTERVAL 30 DAY),
    `status` = 'active'
WHERE (`expires_at` IS NULL OR `expires_at` < NOW())
  AND NOT EXISTS (
    SELECT 1 FROM `schema_data_fixes` WHERE `name` = '77-clan-lifecycle-fix'
  );

INSERT IGNORE INTO `schema_data_fixes` (`name`) VALUES ('77-clan-lifecycle-fix');
