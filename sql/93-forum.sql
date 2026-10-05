-- ============================================================
-- 93-forum.sql  —  RACKET RPG Panel Native Forum System
-- ============================================================

CREATE TABLE panel_forum_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(64) NOT NULL,
  name_ro VARCHAR(64) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  description_en VARCHAR(255),
  description_ro VARCHAR(255),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forums (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  parent_forum_id INT UNSIGNED NULL DEFAULT NULL,
  name VARCHAR(64) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  description VARCHAR(255),
  icon VARCHAR(32) DEFAULT 'MessageSquare',
  access_type ENUM('public','registered','staff','faction','clan','custom') NOT NULL DEFAULT 'public',
  access_target VARCHAR(64) NULL COMMENT 'faction_id or clan_id for restricted forums',
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  topic_count INT UNSIGNED NOT NULL DEFAULT 0,
  post_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_topic_id INT UNSIGNED NULL,
  last_topic_title VARCHAR(128) NULL,
  last_post_at DATETIME NULL,
  last_post_account_id INT UNSIGNED NULL,
  last_post_username VARCHAR(32) NULL,
  topic_template TEXT NULL COMMENT 'JSON topic template definition',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forum_category FOREIGN KEY (category_id) REFERENCES panel_forum_categories(id),
  INDEX idx_forum_category (category_id, sort_order),
  INDEX idx_forum_parent (parent_forum_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_topics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  forum_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NOT NULL COMMENT 'accounts.id',
  author_username VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  type ENUM('normal','pinned','announcement','global') NOT NULL DEFAULT 'normal',
  status ENUM('open','locked') NOT NULL DEFAULT 'open',
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  reply_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_post_id INT UNSIGNED NULL,
  last_post_at DATETIME NULL,
  last_post_account_id INT UNSIGNED NULL,
  last_post_username VARCHAR(32) NULL,
  has_poll TINYINT(1) NOT NULL DEFAULT 0,
  template_data JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by_account_id INT UNSIGNED NULL,
  delete_reason VARCHAR(500) NULL,
  CONSTRAINT fk_topic_forum FOREIGN KEY (forum_id) REFERENCES panel_forums(id),
  INDEX idx_topic_forum_list (forum_id, type, last_post_at),
  INDEX idx_topic_author (account_id),
  INDEX idx_topic_deleted (deleted_at),
  FULLTEXT INDEX ft_topics_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  forum_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NOT NULL COMMENT 'accounts.id',
  author_username VARCHAR(32) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  is_first_post TINYINT(1) NOT NULL DEFAULT 0,
  edited_at DATETIME NULL,
  edited_by_account_id INT UNSIGNED NULL,
  edit_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by_account_id INT UNSIGNED NULL,
  delete_reason VARCHAR(500) NULL,
  CONSTRAINT fk_post_topic FOREIGN KEY (topic_id) REFERENCES panel_forum_topics(id),
  INDEX idx_post_topic (topic_id, created_at),
  INDEX idx_post_author (account_id),
  INDEX idx_post_deleted (deleted_at),
  FULLTEXT INDEX ft_posts_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_post_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  editor_account_id INT UNSIGNED NOT NULL,
  old_content MEDIUMTEXT NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_topic_reads (
  account_id INT UNSIGNED NOT NULL,
  topic_id INT UNSIGNED NOT NULL,
  last_read_post_id INT UNSIGNED NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, topic_id),
  INDEX idx_reads_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  topic_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subscription (account_id, topic_id),
  INDEX idx_sub_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_bookmarks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  topic_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bookmark (account_id, topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_account_id INT UNSIGNED NOT NULL,
  reporter_username VARCHAR(32) NOT NULL,
  topic_id INT UNSIGNED NOT NULL,
  post_id INT UNSIGNED NULL,
  reason ENUM('spam','off_topic','harassment','advertising','rule_violation','other') NOT NULL,
  details VARCHAR(500) NULL,
  status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  resolved_by_account_id INT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  resolution_note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_status (status, created_at),
  INDEX idx_report_reporter (reporter_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_modlog (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_account_id INT UNSIGNED NOT NULL,
  actor_username VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type ENUM('topic','post','forum','category') NOT NULL,
  target_id INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_modlog_actor (actor_account_id),
  INDEX idx_modlog_target (target_type, target_id),
  INDEX idx_modlog_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_polls (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL UNIQUE,
  question VARCHAR(255) NOT NULL,
  max_selections TINYINT UNSIGNED NOT NULL DEFAULT 1,
  allows_change TINYINT(1) NOT NULL DEFAULT 0,
  closes_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_poll_topic FOREIGN KEY (topic_id) REFERENCES panel_forum_topics(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_poll_options (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  poll_id INT UNSIGNED NOT NULL,
  label VARCHAR(200) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  votes_count INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_option_poll FOREIGN KEY (poll_id) REFERENCES panel_forum_polls(id),
  INDEX idx_option_poll (poll_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE panel_forum_poll_votes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  poll_id INT UNSIGNED NOT NULL,
  option_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_poll_vote (poll_id, account_id, option_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed data
-- ============================================================

INSERT INTO panel_forum_categories (name_en, name_ro, slug, description_en, description_ro, sort_order) VALUES
('RACKET', 'RACKET', 'racket', 'Official RACKET RPG announcements and news', 'Anunțuri și noutăți oficiale', 1),
('COMMUNITY', 'COMUNITATE', 'community', 'General community discussion', 'Discuții generale ale comunității', 2),
('SUPPORT', 'SUPORT', 'support', 'Get help and report issues', 'Obține ajutor și raportează probleme', 3),
('FACTIONS', 'FACȚIUNI', 'factions', 'Faction-specific forums', 'Forumuri specifice facțiunilor', 4),
('CLANS', 'CLANURI', 'clans', 'Clan discussion', 'Discuții despre clanuri', 5),
('MARKETPLACE', 'PIAȚA', 'marketplace', 'Buy and sell in-game items', 'Cumpără și vinde obiecte din joc', 6);

INSERT INTO panel_forums (category_id, name, slug, description, icon, access_type, sort_order) VALUES
(1, 'Announcements', 'announcements', 'Official server announcements', 'Megaphone', 'public', 1),
(1, 'Server Updates', 'server-updates', 'Changelog and update notes', 'Newspaper', 'public', 2),
(1, 'Rules & Information', 'rules', 'Server rules and important information', 'BookOpen', 'public', 3),
(2, 'General Discussion', 'general', 'Talk about anything', 'MessageCircle', 'registered', 1),
(2, 'Media & Screenshots', 'media', 'Share your in-game screenshots and videos', 'Camera', 'registered', 2),
(2, 'Suggestions', 'suggestions', 'Suggest improvements to the server', 'Lightbulb', 'registered', 3),
(3, 'Help & Questions', 'help', 'Ask for help from the community', 'HelpCircle', 'registered', 1),
(3, 'Bug Reports', 'bugs', 'Report technical issues', 'Bug', 'registered', 2),
(3, 'Player Reports', 'reports', 'Report rule-breaking players', 'Flag', 'registered', 3),
(4, 'Police Department', 'lspd', 'LSPD internal forum', 'Shield', 'faction', 1),
(4, 'Sheriff Department', 'sheriff', 'Sheriff internal forum', 'Shield', 'faction', 2),
(4, 'FIB', 'fib', 'FIB internal forum', 'Shield', 'faction', 3),
(4, 'Medical Services', 'medic', 'Medical services internal forum', 'Heart', 'faction', 4),
(5, 'Clan Discussion', 'clan-general', 'General clan discussions', 'Users', 'registered', 1),
(6, 'Vehicles', 'vehicles', 'Buy and sell vehicles', 'Car', 'registered', 1),
(6, 'Businesses', 'businesses', 'Buy and sell businesses', 'Building2', 'registered', 2),
(6, 'Properties', 'properties', 'Buy and sell properties', 'Home', 'registered', 3),
(6, 'Other', 'market-other', 'Other marketplace items', 'Package', 'registered', 4);

UPDATE panel_forums SET access_target = 'police' WHERE slug = 'lspd';
UPDATE panel_forums SET access_target = 'sheriff' WHERE slug = 'sheriff';
UPDATE panel_forums SET access_target = 'fib' WHERE slug = 'fib';
UPDATE panel_forums SET access_target = 'medic' WHERE slug = 'medic';
