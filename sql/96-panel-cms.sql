-- 96-panel-cms.sql — Wiki, legal pages, editable rules (panel-owned CMS)
USE `rpgblipmade`;

CREATE TABLE IF NOT EXISTS `panel_wiki_categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(128) NOT NULL,
  `name_ro` VARCHAR(128) NOT NULL,
  `description_en` VARCHAR(255) NULL,
  `description_ro` VARCHAR(255) NULL,
  `icon` VARCHAR(32) NOT NULL DEFAULT 'BookOpen',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_wiki_cat_slug` (`slug`),
  INDEX `idx_wiki_cat_visible_sort` (`is_visible`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `panel_wiki_articles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT UNSIGNED NOT NULL,
  `slug` VARCHAR(96) NOT NULL,
  `title_en` VARCHAR(191) NOT NULL,
  `title_ro` VARCHAR(191) NOT NULL,
  `summary_en` VARCHAR(512) NULL,
  `summary_ro` VARCHAR(512) NULL,
  `content_en` MEDIUMTEXT NOT NULL,
  `content_ro` MEDIUMTEXT NOT NULL,
  `status` ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by_account_id` INT UNSIGNED NULL,
  `updated_by_account_id` INT UNSIGNED NULL,
  `published_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_wiki_article_slug` (`slug`),
  INDEX `idx_wiki_article_cat_status` (`category_id`, `status`),
  INDEX `idx_wiki_article_featured` (`is_featured`, `status`),
  INDEX `idx_wiki_article_updated` (`updated_at`),
  FULLTEXT KEY `ft_wiki_article_search` (`title_en`, `title_ro`, `summary_en`, `summary_ro`),
  CONSTRAINT `fk_wiki_article_category` FOREIGN KEY (`category_id`) REFERENCES `panel_wiki_categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wiki_article_created_by` FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wiki_article_updated_by` FOREIGN KEY (`updated_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `panel_legal_pages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `page_key` VARCHAR(32) NOT NULL,
  `slug` VARCHAR(64) NOT NULL,
  `title_en` VARCHAR(191) NOT NULL,
  `title_ro` VARCHAR(191) NOT NULL,
  `content_en` MEDIUMTEXT NOT NULL,
  `content_ro` MEDIUMTEXT NOT NULL,
  `status` ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `effective_at` DATE NULL,
  `published_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_by_account_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_legal_page_key` (`page_key`),
  UNIQUE KEY `uq_legal_page_slug` (`slug`),
  CONSTRAINT `fk_legal_updated_by` FOREIGN KEY (`updated_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `panel_legal_page_revisions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `page_id` INT UNSIGNED NOT NULL,
  `version` INT UNSIGNED NOT NULL,
  `title_en` VARCHAR(191) NOT NULL,
  `title_ro` VARCHAR(191) NOT NULL,
  `content_en` MEDIUMTEXT NOT NULL,
  `content_ro` MEDIUMTEXT NOT NULL,
  `effective_at` DATE NULL,
  `changed_by_account_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_legal_rev_page` (`page_id`, `version`),
  CONSTRAINT `fk_legal_rev_page` FOREIGN KEY (`page_id`) REFERENCES `panel_legal_pages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_legal_rev_actor` FOREIGN KEY (`changed_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `panel_rule_sections` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(64) NOT NULL,
  `title_en` VARCHAR(191) NOT NULL,
  `title_ro` VARCHAR(191) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_rule_section_slug` (`slug`),
  INDEX `idx_rule_section_visible_sort` (`is_visible`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `panel_rules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `section_id` INT UNSIGNED NOT NULL,
  `rule_number` VARCHAR(16) NOT NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_ro` VARCHAR(255) NOT NULL,
  `description_en` TEXT NOT NULL,
  `description_ro` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_by_account_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_rules_section_sort` (`section_id`, `sort_order`),
  CONSTRAINT `fk_rules_section` FOREIGN KEY (`section_id`) REFERENCES `panel_rule_sections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rules_updated_by` FOREIGN KEY (`updated_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Wiki categories (structure only; content via staff CMS)
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('getting-started', 'Getting Started', 'Începe aici', NULL, NULL, 1, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('account-character', 'Account & Character', 'Cont și personaj', NULL, NULL, 2, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('jobs', 'Jobs', 'Joburi', NULL, NULL, 3, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('factions', 'Factions', 'Facțiuni', NULL, NULL, 4, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('clans', 'Clans', 'Clanuri', NULL, NULL, 5, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('economy', 'Economy', 'Economie', NULL, NULL, 6, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('vehicles', 'Vehicles', 'Vehicule', NULL, NULL, 7, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('properties', 'Properties', 'Proprietăți', NULL, NULL, 8, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('licenses', 'Licenses', 'Licențe', NULL, NULL, 9, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('illegal', 'Illegal Activities', 'Activități ilegale', NULL, NULL, 10, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('turfs', 'Turfs', 'Teritorii', NULL, NULL, 11, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('commands', 'Commands', 'Comenzi', NULL, NULL, 12, 1);
INSERT IGNORE INTO panel_wiki_categories (slug, name_en, name_ro, description_en, description_ro, sort_order, is_visible) VALUES ('systems', 'Server Systems', 'Sisteme server', NULL, NULL, 13, 1);

-- Legal page shells (draft until published by admin)
INSERT IGNORE INTO panel_legal_pages (page_key, slug, title_en, title_ro, content_en, content_ro, status, version) VALUES ('terms', 'terms', 'Terms of Service', 'Termeni și condiții', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', 'draft', 1);
INSERT IGNORE INTO panel_legal_pages (page_key, slug, title_en, title_ro, content_en, content_ro, status, version) VALUES ('privacy', 'privacy', 'Privacy Policy', 'Politica de confidențialitate', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', 'draft', 1);
INSERT IGNORE INTO panel_legal_pages (page_key, slug, title_en, title_ro, content_en, content_ro, status, version) VALUES ('refund', 'refund', 'Refund Policy', 'Politica de rambursare', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', 'draft', 1);
INSERT IGNORE INTO panel_legal_pages (page_key, slug, title_en, title_ro, content_en, content_ro, status, version) VALUES ('cookies', 'cookies', 'Cookie Policy', 'Politica cookie', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', '## Draft\n\nThis policy text is managed by RACKET staff in the panel CMS. Replace this placeholder with your official wording.\n\nDo not treat this draft as legal advice.', 'draft', 1);

-- Rules migrated from panel locale copy (visible rules)
INSERT INTO panel_rule_sections (slug, title_en, title_ro, sort_order, is_visible) VALUES ('general', '1. General Rules', '1. Reguli Generale', 1, 1);
INSERT INTO panel_rule_sections (slug, title_en, title_ro, sort_order, is_visible) VALUES ('accounts', '2. Accounts & Security', '2. Conturi și Securitate', 2, 1);
INSERT INTO panel_rule_sections (slug, title_en, title_ro, sort_order, is_visible) VALUES ('gameplay', '3. Gameplay & Economy', '3. Gameplay și Economie', 3, 1);
INSERT INTO panel_rule_sections (slug, title_en, title_ro, sort_order, is_visible) VALUES ('factions', '4. Factions & Turfs', '4. Facțiuni și Turfs', 4, 1);
INSERT INTO panel_rule_sections (slug, title_en, title_ro, sort_order, is_visible) VALUES ('staff', '5. Administration', '5. Administrație', 5, 1);
SET @sec_general = (SELECT id FROM panel_rule_sections WHERE slug='general' LIMIT 1);
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '1.1', 'Behavior & Communication', 'Comportament și Limbaj', 'Excessive toxicity, severe insults, hate speech, and personal threats are prohibited across all community channels.', 'Jignirile grave, discriminarea, toxicitatea excesivă și amenințările la persoană sunt interzise pe toate canalele comunității.', 1, 1 FROM panel_rule_sections WHERE slug='general' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '1.2', 'Cheating & Exploits', 'Cheaturi și Programe Ilegale', 'Using third-party cheats (aimbot, ESP, speedhack, godmode) or unauthorized modifications results in a permanent ban.', 'Utilizarea de software extern (aimbot, esp, speedhack, godmode) sau modificări care oferă avantaje nepermise se sancționează cu ban permanent.', 2, 1 FROM panel_rule_sections WHERE slug='general' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '1.3', 'Real Money Trading (RMT)', 'Comerț Real (RMT)', 'Buying or selling in-game currency, vehicles, or accounts for real money leads to account wipe and permanent ban.', 'Vânzarea sau cumpărarea de bunuri din joc (bani, vehicule, conturi) pe bani reali duce la ștergerea averii și ban permanent.', 3, 1 FROM panel_rule_sections WHERE slug='general' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '2.1', 'Account Ownership', 'Responsabilitatea Contului', 'Every player is solely responsible for actions taken on their account. Sharing or selling accounts is forbidden.', 'Fiecare jucător este direct răspunzător de acțiunile comise de pe contul său. Împrumutul sau vânzarea conturilor este strict interzisă.', 1, 1 FROM panel_rule_sections WHERE slug='accounts' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '2.2', 'Bug Abuse', 'Abuz de Erori (Bug Abuse)', 'Exploiting game or economy bugs for personal or financial gain is penalized.', 'Exploatarea erorilor din joc pentru obținerea de avantaje financiare sau de progres se pedepsește cu sancțiuni administrative.', 2, 1 FROM panel_rule_sections WHERE slug='accounts' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '3.1', 'Job Activities', 'Desfășurarea Joburilor', 'Intentionally and repeatedly disrupting players working civilian jobs is forbidden.', 'Deranjarea intenționată și repetată a jucătorilor la joburile civile este interzisă.', 1, 1 FROM panel_rule_sections WHERE slug='gameplay' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '3.2', 'Scamming & Transactions', 'Tranzacții și Înșelăciuni', 'Scams involving unofficial off-system deals are not compensated by administration.', 'Înșelăciunile legate de sisteme nesuportate oficial de interfața jocului nu sunt asigurate de administrație.', 2, 1 FROM panel_rule_sections WHERE slug='gameplay' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '4.1', 'Faction Activity', 'Regulament Facțiuni', 'Faction members must perform department responsibilities and follow leader directives.', 'Membrii facțiunilor au obligația de a respecta atribuțiile specifice departamentului și instrucțiunile liderilor.', 1, 1 FROM panel_rule_sections WHERE slug='factions' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '4.2', 'Turf Wars', 'Războaie de Teritorii', 'Territory turf wars are restricted to eligible clans and organizations.', 'Participarea la teritoriile disputate este rezervată clanurilor și facțiunilor eligibile.', 2, 1 FROM panel_rule_sections WHERE slug='factions' LIMIT 1;
INSERT INTO panel_rules (section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order, is_visible) SELECT id, '5.1', 'Staff Cooperation', 'Colaborarea cu Staff-ul', 'Players must cooperate during administrative inquiries and follow staff decisions.', 'Jucătorii au obligația de a coopera în timpul verificărilor administrative și de a respecta deciziile staff-ului.', 1, 1 FROM panel_rule_sections WHERE slug='staff' LIMIT 1;
