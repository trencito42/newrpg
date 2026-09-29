-- sunset_missions: reputation and history tables
CREATE TABLE IF NOT EXISTS `sunset_mission_reputation` (
    `id`                 INT AUTO_INCREMENT PRIMARY KEY,
    `character_id`       INT NOT NULL,
    `contact`            VARCHAR(32) NOT NULL,
    `mission`            VARCHAR(64),
    `reputation`         INT DEFAULT 0,
    `missions_completed` INT DEFAULT 0,
    `last_mission`       BIGINT DEFAULT 0,
    UNIQUE KEY `char_contact` (`character_id`, `contact`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sunset_mission_history` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `character_id` INT NOT NULL,
    `mission`      VARCHAR(64) NOT NULL,
    `started_at`   BIGINT NOT NULL,
    `completed_at` BIGINT,
    `result`       VARCHAR(16) NOT NULL DEFAULT 'abandoned',
    `reward`       INT DEFAULT 0,
    `variant`      JSON,
    INDEX `idx_char`    (`character_id`),
    INDEX `idx_mission` (`mission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
