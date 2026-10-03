-- ═══════════════════════════════════════════════════════════════
--  79-shop-entitlements.sql
--  Racket Shop entitlements (owned by sunset_shop) + shop audit log.
--  An entitlement is a purchased, not-yet-used right (character rename,
--  clan rename). consumed_at IS NULL means unused; consumption is a guarded
--  `UPDATE ... WHERE consumed_at IS NULL` so one entitlement is used once.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shop_entitlements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  character_id INT UNSIGNED,
  clan_id INT UNSIGNED,
  entitlement_type VARCHAR(64) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  metadata JSON,
  order_id INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  consumed_at TIMESTAMP NULL,
  KEY idx_account_id (account_id),
  KEY idx_character_id (character_id),
  KEY idx_entitlement_type (entitlement_type),
  KEY idx_consumed (consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Every Racket Credit mutation (debit, refund) and every entitlement
-- consumption (old/new name) is recorded here.
CREATE TABLE IF NOT EXISTS shop_audit_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(48) NOT NULL,
  account_id INT UNSIGNED,
  character_id INT UNSIGNED,
  order_id INT UNSIGNED,
  amount INT NOT NULL DEFAULT 0,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_audit_account (account_id),
  KEY idx_shop_audit_order (order_id),
  KEY idx_shop_audit_event (event),
  KEY idx_shop_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
