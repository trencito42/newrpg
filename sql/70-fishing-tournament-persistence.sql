-- ═══════════════════════════════════════════════════════════════
--  70-fishing-tournament-persistence.sql
--  Persist fishing tournament lifecycle, participants and per-catch
--  scores so a resource/server restart resumes or settles
--  deterministically. Catches are the source of truth for scores.
--  Idempotent (CREATE TABLE IF NOT EXISTS). Never edit once applied.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fishing_tournaments (
    tournament_id VARCHAR(64) NOT NULL PRIMARY KEY,
    status ENUM('active','settling','settled','cancelled') NOT NULL DEFAULT 'active',
    is_dev_test TINYINT(1) NOT NULL DEFAULT 0,
    started_at INT NOT NULL,
    ends_at INT NOT NULL,
    settled_at INT NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ft_status (status, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fishing_tournament_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id VARCHAR(64) NOT NULL,
    character_id INT NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    joined_at INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ftp_member (tournament_id, character_id),
    KEY idx_ftp_char (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fishing_tournament_catches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id VARCHAR(64) NOT NULL,
    character_id INT NOT NULL,
    catch_key VARCHAR(96) NOT NULL,
    item VARCHAR(64) NOT NULL,
    weight_10 INT NOT NULL,
    caught_at INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ftc_idem (tournament_id, character_id, catch_key),
    KEY idx_ftc_score (tournament_id, character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
