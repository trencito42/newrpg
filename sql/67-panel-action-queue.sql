-- Web requests are intents; only FXServer executes gameplay administration.
CREATE TABLE IF NOT EXISTS `panel_action_queue` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `request_id` CHAR(36) NOT NULL,
  `actor_account_id` INT UNSIGNED NOT NULL,
  `actor_character_id` INT UNSIGNED NULL,
  `action` ENUM('ban', 'unban', 'mute', 'warn', 'set_faction') NOT NULL,
  `target_account_id` INT UNSIGNED NOT NULL,
  `target_character_id` INT UNSIGNED NULL,
  `payload_json` JSON NULL,
  `reason` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `claimed_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `result_json` JSON NULL,
  `error_message` VARCHAR(255) NULL,
  UNIQUE KEY `uq_panel_action_request` (`request_id`),
  KEY `idx_panel_action_pending` (`status`, `id`),
  KEY `idx_panel_action_actor` (`actor_account_id`, `id`),
  CONSTRAINT `fk_panel_action_actor` FOREIGN KEY (`actor_account_id`) REFERENCES `accounts` (`id`),
  CONSTRAINT `fk_panel_action_target` FOREIGN KEY (`target_account_id`) REFERENCES `accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing /mute and /banip actions were never representable in this enum.
ALTER TABLE `admin_sanctions` MODIFY `action`
  ENUM('warn','kick','tempban','ban','banip','unban','mute','jail','unjail','freeze','slap','clearwarns') NOT NULL;
