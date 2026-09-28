-- 007_warning_lifecycle.sql
-- Add warning lifecycle tracking to prevent consumed warnings from re-triggering bans after unban

ALTER TABLE sanctions
  ADD COLUMN consumed_by_sanction_id BIGINT UNSIGNED NULL AFTER revoked_by_account_id,
  ADD COLUMN resolved_at TIMESTAMP(6) NULL AFTER consumed_by_sanction_id,
  ADD CONSTRAINT fk_sanctions_consumed_by FOREIGN KEY (consumed_by_sanction_id) REFERENCES sanctions(id) ON DELETE SET NULL,
  ADD KEY idx_sanctions_active_warning (target_account_id, sanction_type, revoked_at, consumed_by_sanction_id, expires_at);
