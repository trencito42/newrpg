-- Casino audit log (also created lazily by sunset_casino/shared/rng.lua CasinoLog).
CREATE TABLE IF NOT EXISTS casino_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_id INT UNSIGNED NOT NULL DEFAULT 0,
  game VARCHAR(24) NOT NULL,
  event VARCHAR(24) NOT NULL,
  bet INT NOT NULL DEFAULT 0,
  payout INT NOT NULL DEFAULT 0,
  detail VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_char (character_id, created_at)
);
