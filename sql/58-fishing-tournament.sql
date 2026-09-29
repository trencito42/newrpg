-- ═══════════════════════════════════════════════════════════════
--  58-fishing-tournament.sql
--  Schema for fishing tournament persistent rewards and history
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fishing_tournament_rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id VARCHAR(64) NOT NULL,
    character_id INT NOT NULL,
    `rank` INT NOT NULL,
    cash INT NOT NULL DEFAULT 0,
    xp INT NOT NULL DEFAULT 0,
    claimed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ft_reward (tournament_id, character_id),
    KEY idx_ft_pending_claim (character_id, claimed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fishing_tournament_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id VARCHAR(64) NOT NULL,
    character_id INT NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    `rank` INT NOT NULL,
    fish_count INT NOT NULL DEFAULT 0,
    total_weight_10 INT NOT NULL DEFAULT 0,
    biggest_fish_weight_10 INT NOT NULL DEFAULT 0,
    biggest_fish_item VARCHAR(64) NULL DEFAULT NULL,
    qualified TINYINT(1) NOT NULL DEFAULT 1,
    reward_cash INT NOT NULL DEFAULT 0,
    reward_xp INT NOT NULL DEFAULT 0,
    started_at INT NOT NULL,
    ended_at INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ft_hist (tournament_id, character_id),
    KEY idx_ft_hist_tourn (tournament_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
