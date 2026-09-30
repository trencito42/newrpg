-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — 60-fnc.sql
--  Free Name Change (FNC) tokens & self-selection support
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE `characters`
    ADD COLUMN IF NOT EXISTS `fnc_tokens` INT NOT NULL DEFAULT 0;
