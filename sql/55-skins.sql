CREATE TABLE IF NOT EXISTS player_skins (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id   INT UNSIGNED NOT NULL,
    model       VARCHAR(64)  NOT NULL,
    source      ENUM('shop','battlepass','admin') NOT NULL DEFAULT 'shop',
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_player_model (player_id, model),
    CONSTRAINT fk_player_skins FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
