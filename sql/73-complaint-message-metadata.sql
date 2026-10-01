-- Keep complaint messages compatible with the panel's thread view and staff actions.
-- Additive: existing messages retain their sender account and default to a neutral role.
ALTER TABLE panel_complaint_messages
  ADD COLUMN IF NOT EXISTS sender_character_id INT UNSIGNED NULL AFTER sender_account_id,
  ADD COLUMN IF NOT EXISTS role_badge VARCHAR(32) NOT NULL DEFAULT 'USER' AFTER is_staff;
