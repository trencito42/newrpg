-- 64-retention-indexes.sql
-- Server perf pass 2026-10-01. Indexes on created_at so the bounded retention
-- purges (batched DELETE ... LIMIT in the owning resources) do not full-scan,
-- plus indexes for UPDATE/SELECT filters that had none.

-- Retention-purge support (created_at range scans)
CREATE INDEX IF NOT EXISTS idx_money_tx_created ON money_transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_anticheat_strikes_created ON anticheat_strikes (created_at);
CREATE INDEX IF NOT EXISTS idx_anticheat_flags_created ON anticheat_flags (created_at);
CREATE INDEX IF NOT EXISTS idx_clan_audit_created ON clan_audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_robbery_audit_created ON robbery_audit (created_at);
CREATE INDEX IF NOT EXISTS idx_dealership_admin_log_created ON dealership_admin_log (created_at);

-- sunset_properties: UPDATE characters SET home_property_id = NULL WHERE home_property_id = ?
-- (and core cleanup) previously scanned the whole characters table.
CREATE INDEX IF NOT EXISTS idx_characters_home_property ON characters (home_property_id);

-- sunset_impound hourly auto-sell: WHERE status='impounded' AND impounded_at < ?
CREATE INDEX IF NOT EXISTS idx_impound_status_at ON impounded_vehicles (status, impounded_at);
