-- ═══════════════════════════════════════════════════════════════
--  76-clan-lifecycle.sql
--  Add clan lifetime expiration, grace/active status, and backfill
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE `clans`
  ADD COLUMN IF NOT EXISTS `expires_at` TIMESTAMP NULL AFTER `max_members`,
  ADD COLUMN IF NOT EXISTS `status` ENUM('active', 'grace', 'expired') NOT NULL DEFAULT 'active' AFTER `expires_at`;

-- Safely backfill existing clans without lifetime data (30 days from creation or NOW)
UPDATE `clans`
SET `expires_at` = DATE_ADD(COALESCE(`created_at`, NOW()), INTERVAL 30 DAY),
    `status` = 'active'
WHERE `expires_at` IS NULL;
