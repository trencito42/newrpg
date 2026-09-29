-- Separate cooldown table so reputation rows don't need a `mission` column
CREATE TABLE IF NOT EXISTS `sunset_mission_cooldowns` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `character_id` INT NOT NULL,
    `mission`      VARCHAR(64) NOT NULL,
    `last_mission` BIGINT DEFAULT 0,
    UNIQUE KEY `char_mission` (`character_id`, `mission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
