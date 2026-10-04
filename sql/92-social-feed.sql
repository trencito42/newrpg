-- RACKET Social Feed
-- Owned by: sunset_social
-- Tables: social_posts, social_post_likes, social_comments, social_notifications

CREATE TABLE IF NOT EXISTS social_posts (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_id INT UNSIGNED NOT NULL,
    body        VARCHAR(500) NULL,
    media_id    INT UNSIGNED NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NULL,
    deleted_at  TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_social_posts_char   (character_id, id),
    KEY idx_social_posts_global (id),
    KEY idx_social_posts_media  (media_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_post_likes (
    post_id      BIGINT UNSIGNED NOT NULL,
    character_id INT UNSIGNED NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, character_id),
    KEY idx_social_likes_char (character_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_comments (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id           BIGINT UNSIGNED NOT NULL,
    character_id      INT UNSIGNED NOT NULL,
    parent_comment_id BIGINT UNSIGNED NULL,
    body              VARCHAR(400) NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NULL,
    deleted_at        TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_social_comments_post   (post_id, id),
    KEY idx_social_comments_parent (parent_comment_id, id),
    KEY idx_social_comments_char   (character_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_notifications (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_id      INT UNSIGNED NOT NULL,
    actor_character_id INT UNSIGNED NOT NULL,
    type              ENUM('like','comment','reply') NOT NULL,
    post_id           BIGINT UNSIGNED NOT NULL,
    comment_id        BIGINT UNSIGNED NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at           TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_social_notif_char (character_id, read_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
