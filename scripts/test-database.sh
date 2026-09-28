#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source .env if present and environment variables not set
if [[ -f "$project_root/.env" && -z "${MYSQL_HOST:-}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$project_root/.env"
  set +a
fi

export MYSQL_PWD="${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
host="${MYSQL_HOST:-127.0.0.1}"
user="${MYSQL_USER:?MYSQL_USER is required}"
database="${MYSQL_DATABASE:?MYSQL_DATABASE is required}"

client=(mariadb -h "$host" -u "$user" "$database" --batch --skip-column-names)

# Verify database connection
if ! "${client[@]}" -e 'SELECT 1' >/dev/null 2>&1; then
  echo '[db-test] ERROR: Could not connect to MariaDB database' >&2
  exit 1
fi

echo '[db-test] Running migrations...'
env MYSQL_HOST="$host" MYSQL_DATABASE="$database" MYSQL_USER="$user" MYSQL_PASSWORD="$MYSQL_PWD" MIGRATIONS_DIR="$project_root/database/migrations" bash "$project_root/scripts/migrate.sh"

echo '[db-test] Running schema invariant and lifecycle tests...'

cleanup_test_data() {
  "${client[@]}" -e "
    DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE username_normalized LIKE 'test_%');
    DELETE FROM sanctions WHERE target_account_id IN (SELECT id FROM accounts WHERE username_normalized LIKE 'test_%');
    DELETE FROM player_reports WHERE reporter_account_id IN (SELECT id FROM accounts WHERE username_normalized LIKE 'test_%');
    DELETE FROM newbie_questions WHERE asker_account_id IN (SELECT id FROM accounts WHERE username_normalized LIKE 'test_%');
    DELETE FROM players WHERE account_id IN (SELECT id FROM accounts WHERE username_normalized LIKE 'test_%');
    DELETE FROM accounts WHERE username_normalized LIKE 'test_%';
  "
}

cleanup_test_data

# 1. Accounts Unique Constraint Tests (Ensuring syntactically identical valid column/value pairs)
"${client[@]}" -e "INSERT INTO accounts(username,username_normalized,email,email_normalized,password_hash) VALUES('Test_Alice','test_alice','Alice@Example.com','test_alice@example.com','hash')"

# Duplicate username must fail specifically
if "${client[@]}" -e "INSERT INTO accounts(username,username_normalized,email,email_normalized,password_hash) VALUES('TEST_ALICE','test_alice','other@example.com','other@example.com','hash')" >/dev/null 2>&1; then
  echo '[db-test] ERROR: Duplicate username was accepted by database' >&2
  exit 1
fi

# Duplicate email must fail specifically
if "${client[@]}" -e "INSERT INTO accounts(username,username_normalized,email,email_normalized,password_hash) VALUES('Test_Bob','test_bob','test_alice@example.com','test_alice@example.com','hash')" >/dev/null 2>&1; then
  echo '[db-test] ERROR: Duplicate email was accepted by database' >&2
  exit 1
fi

account_id="$("${client[@]}" -e "SELECT id FROM accounts WHERE username_normalized='test_alice'")"
"${client[@]}" -e "INSERT INTO players(account_id,sex,model) VALUES($account_id,'male','a_m_m_bevhills_02')"

# 2. Session Invariants: Only one active session per account
"${client[@]}" -e "INSERT INTO sessions(id,account_id,server_source) VALUES(UUID(),$account_id,1)"
if "${client[@]}" -e "INSERT INTO sessions(id,account_id,server_source) VALUES(UUID(),$account_id,2)" >/dev/null 2>&1; then
  echo '[db-test] ERROR: Duplicate active session was accepted' >&2
  exit 1
fi
"${client[@]}" -e "UPDATE sessions SET ended_at=UTC_TIMESTAMP(6), end_reason='test_completed' WHERE account_id=$account_id AND ended_at IS NULL"

# 3. Sanction Expiry Comparison (UTC)
"${client[@]}" -e "INSERT INTO sanctions(sanction_type,target_account_id,target_username,actor_username,reason,expires_at) VALUES('ban',$account_id,'Test_Alice','CONSOLE','expired',UTC_TIMESTAMP(6)-INTERVAL 1 SECOND),('ban',$account_id,'Test_Alice','CONSOLE','active',UTC_TIMESTAMP(6)+INTERVAL 1 HOUR)"
active_bans="$("${client[@]}" -e "SELECT COUNT(*) FROM sanctions WHERE target_account_id=$account_id AND sanction_type='ban' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP(6))")"
[[ "$active_bans" == '1' ]] || { echo "[db-test] ERROR: Expected 1 active temporary ban, got $active_bans" >&2; exit 1; }

# 4. Warning Lifecycle & Strike Consumption
"${client[@]}" -e "INSERT INTO sanctions(sanction_type,target_account_id,target_username,actor_username,reason) VALUES('warning',$account_id,'Test_Alice','CONSOLE','Warn 1'),('warning',$account_id,'Test_Alice','CONSOLE','Warn 2'),('warning',$account_id,'Test_Alice','CONSOLE','Warn 3')"
active_warns="$("${client[@]}" -e "SELECT COUNT(*) FROM sanctions WHERE target_account_id=$account_id AND sanction_type='warning' AND revoked_at IS NULL AND consumed_by_sanction_id IS NULL")"
[[ "$active_warns" == '3' ]] || { echo "[db-test] ERROR: Expected 3 active warnings, got $active_warns" >&2; exit 1; }

# Automatic 3/3 ban resolves previous warnings
"${client[@]}" -e "INSERT INTO sanctions(sanction_type,target_account_id,target_username,actor_username,reason) VALUES('ban',$account_id,'Test_Alice','CONSOLE','3/3 auto ban')"
ban_id="$("${client[@]}" -e "SELECT MAX(id) FROM sanctions WHERE target_account_id=$account_id AND sanction_type='ban'")"
"${client[@]}" -e "UPDATE sanctions SET consumed_by_sanction_id=$ban_id, resolved_at=UTC_TIMESTAMP(6) WHERE target_account_id=$account_id AND sanction_type='warning' AND revoked_at IS NULL AND consumed_by_sanction_id IS NULL"

unconsumed_warns="$("${client[@]}" -e "SELECT COUNT(*) FROM sanctions WHERE target_account_id=$account_id AND sanction_type='warning' AND revoked_at IS NULL AND consumed_by_sanction_id IS NULL")"
[[ "$unconsumed_warns" == '0' ]] || { echo "[db-test] ERROR: Expected 0 unconsumed warnings after auto ban, got $unconsumed_warns" >&2; exit 1; }

# Unban account and issue 1 new warning
"${client[@]}" -e "UPDATE sanctions SET revoked_at=UTC_TIMESTAMP(6), revoke_reason='Staff unban' WHERE id=$ban_id"
"${client[@]}" -e "INSERT INTO sanctions(sanction_type,target_account_id,target_username,actor_username,reason) VALUES('warning',$account_id,'Test_Alice','CONSOLE','Fresh warning post unban')"
post_unban_warns="$("${client[@]}" -e "SELECT COUNT(*) FROM sanctions WHERE target_account_id=$account_id AND sanction_type='warning' AND revoked_at IS NULL AND consumed_by_sanction_id IS NULL")"
[[ "$post_unban_warns" == '1' ]] || { echo "[db-test] ERROR: Expected 1 active warning post unban, got $post_unban_warns" >&2; exit 1; }

# 5. Reports Single-Open Invariant
"${client[@]}" -e "INSERT INTO player_reports(reporter_account_id,open_reporter_account_id,reporter_username,reporter_source,message) VALUES($account_id,$account_id,'Test_Alice',1,'first report')"
if "${client[@]}" -e "INSERT INTO player_reports(reporter_account_id,open_reporter_account_id,reporter_username,reporter_source,message) VALUES($account_id,$account_id,'Test_Alice',1,'second report')" >/dev/null 2>&1; then
  echo '[db-test] ERROR: Duplicate open report was accepted' >&2; exit 1
fi
"${client[@]}" -e "UPDATE player_reports SET status='closed',open_reporter_account_id=NULL,closed_at=UTC_TIMESTAMP(6) WHERE reporter_account_id=$account_id; INSERT INTO player_reports(reporter_account_id,open_reporter_account_id,reporter_username,reporter_source,message) VALUES($account_id,$account_id,'Test_Alice',1,'after close report')"

# 6. Newbie Questions Single-Open Invariant
"${client[@]}" -e "INSERT INTO newbie_questions(asker_account_id,open_asker_account_id,asker_username,asker_source,question) VALUES($account_id,$account_id,'Test_Alice',1,'first question')"
if "${client[@]}" -e "INSERT INTO newbie_questions(asker_account_id,open_asker_account_id,asker_username,asker_source,question) VALUES($account_id,$account_id,'Test_Alice',1,'second question')" >/dev/null 2>&1; then
  echo '[db-test] ERROR: Duplicate open question was accepted' >&2; exit 1
fi
"${client[@]}" -e "UPDATE newbie_questions SET status='answered',open_asker_account_id=NULL,handled_at=UTC_TIMESTAMP(6) WHERE asker_account_id=$account_id; INSERT INTO newbie_questions(asker_account_id,open_asker_account_id,asker_username,asker_source,question) VALUES($account_id,$account_id,'Test_Alice',1,'after answer question')"

cleanup_test_data

# 7. Total Migration Count Check
count="$("${client[@]}" -e 'SELECT COUNT(*) FROM schema_migrations')"
[[ "$count" == '7' ]] || { echo "[db-test] ERROR: Expected 7 migrations, got $count" >&2; exit 1; }

echo '[db-test] All database migrations, constraints, sessions, bans, warning lifecycle, and support queue invariants passed!'
