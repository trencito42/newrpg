-- Corrective panel migration. Run against the database selected by the connection.
DROP TABLE IF EXISTS `panel_link_tokens`;

-- Delete only the exact fictional seed from v65, and only if nobody voted.
DELETE FROM `panel_polls`
WHERE `id` = 1
  AND `title_en` = 'Mayor Election — October 2026'
  AND NOT EXISTS (SELECT 1 FROM `panel_poll_votes` WHERE `poll_id` = 1);

-- A vote's option must belong to the same poll, even if a caller bypasses the API.
ALTER TABLE `panel_poll_options`
  ADD UNIQUE KEY `uq_panel_option_poll_id` (`poll_id`, `id`);
ALTER TABLE `panel_poll_votes`
  ADD CONSTRAINT `fk_panel_vote_matching_option`
    FOREIGN KEY (`poll_id`, `option_id`)
    REFERENCES `panel_poll_options` (`poll_id`, `id`) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS `panel_runtime_snapshot` (
  `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  `player_count` SMALLINT UNSIGNED NOT NULL,
  `max_players` SMALLINT UNSIGNED NOT NULL,
  `resource_version` VARCHAR(32) NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
