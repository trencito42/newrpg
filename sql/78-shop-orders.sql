-- ═══════════════════════════════════════════════════════════════
--  78-shop-orders.sql
--  Racket Shop order ledger (owned by sunset_shop).
--  request_id is the client-generated idempotency key: the UNIQUE index makes
--  a replayed or double-submitted purchase impossible to settle twice.
--  status lifecycle: pending -> processing -> completed
--                    pending -> failed            (debit rejected, nothing charged)
--                    processing -> refunded       (delivery failed, RC returned)
--                    processing -> failed         (delivery AND refund failed; staff alert)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shop_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  character_id INT UNSIGNED,
  product_id VARCHAR(64) NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'rc',
  price INT UNSIGNED NOT NULL,
  status ENUM('pending','processing','completed','refunded','failed') NOT NULL DEFAULT 'pending',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY idx_request_id (request_id),
  KEY idx_account_id (account_id),
  KEY idx_character_id (character_id),
  KEY idx_product_id (product_id),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
