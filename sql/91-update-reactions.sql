-- Update reactions: phone characters and panel accounts can like/dislike panel_updates posts
CREATE TABLE IF NOT EXISTS panel_update_reactions (
    update_id    INT NOT NULL,
    reactor_type ENUM('character', 'account') NOT NULL,
    reactor_id   INT NOT NULL,
    reaction     ENUM('like', 'dislike') NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (update_id, reactor_type, reactor_id)
);
