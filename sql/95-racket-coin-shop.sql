-- Racket Coin top-ups (Stripe) + immutable RC ledger; panel shop action type.

ALTER TABLE `panel_action_queue`
  MODIFY `action` VARCHAR(64) NOT NULL;

CREATE TABLE IF NOT EXISTS `racket_coin_topups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `account_id` INT UNSIGNED NOT NULL,
  `package_id` VARCHAR(32) NOT NULL,
  `coins` INT UNSIGNED NOT NULL,
  `amount_minor` INT UNSIGNED NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'usd',
  `stripe_checkout_session_id` VARCHAR(255) NULL,
  `stripe_payment_intent_id` VARCHAR(255) NULL,
  `status` ENUM(
    'created',
    'checkout_created',
    'paid',
    'fulfilled',
    'failed',
    'refunded',
    'disputed'
  ) NOT NULL DEFAULT 'created',
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` TIMESTAMP NULL,
  `fulfilled_at` TIMESTAMP NULL,
  UNIQUE KEY `uq_rc_topup_stripe_session` (`stripe_checkout_session_id`),
  KEY `idx_rc_topup_account` (`account_id`, `id`),
  KEY `idx_rc_topup_status` (`status`, `id`),
  CONSTRAINT `fk_rc_topup_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `racket_coin_ledger` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `account_id` INT UNSIGNED NOT NULL,
  `direction` ENUM('credit', 'debit') NOT NULL,
  `amount` INT UNSIGNED NOT NULL,
  `reason` VARCHAR(64) NOT NULL,
  `reference_type` VARCHAR(32) NOT NULL,
  `reference_id` VARCHAR(64) NOT NULL,
  `balance_after` INT UNSIGNED NOT NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_rc_ledger_reference` (`reference_type`, `reference_id`),
  KEY `idx_rc_ledger_account` (`account_id`, `id`),
  CONSTRAINT `fk_rc_ledger_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
