#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d)"
socket="$test_root/mariadb.sock"
pidfile="$test_root/mariadb.pid"
logfile="$test_root/mariadb.log"
cleanup() {
  if [[ -f "$pidfile" ]]; then kill "$(cat "$pidfile")" >/dev/null 2>&1 || true; fi
  rm -rf "$test_root"
}
trap cleanup EXIT

mariadb-install-db --no-defaults --auth-root-authentication-method=normal --datadir="$test_root/data" >/dev/null
mariadbd --no-defaults --datadir="$test_root/data" --socket="$socket" --pid-file="$pidfile" --log-error="$logfile" --skip-networking --user="$(id -un)" &
for _ in {1..100}; do [[ -S "$socket" ]] && mariadb --protocol=socket --socket="$socket" -uroot -e 'SELECT 1' >/dev/null 2>&1 && break; sleep 0.1; done
if [[ ! -S "$socket" ]]; then cat "$logfile" >&2; exit 1; fi

mariadb --protocol=socket --socket="$socket" -uroot <<'SQL'
CREATE DATABASE rpgmvp_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rpgtest'@'localhost' IDENTIFIED BY 'test-password';
GRANT ALL PRIVILEGES ON rpgmvp_test.* TO 'rpgtest'@'localhost';
SQL

env MYSQL_SOCKET="$socket" MYSQL_DATABASE=rpgmvp_test MYSQL_USER=rpgtest MYSQL_PASSWORD=test-password MIGRATIONS_DIR="$project_root/database/migrations" bash "$project_root/scripts/migrate.sh"
env MYSQL_SOCKET="$socket" MYSQL_DATABASE=rpgmvp_test MYSQL_USER=rpgtest MYSQL_PASSWORD=test-password MIGRATIONS_DIR="$project_root/database/migrations" bash "$project_root/scripts/migrate.sh"

client=(mariadb --protocol=socket --socket="$socket" -urpgtest -ptest-password rpgmvp_test --batch --skip-column-names)
"${client[@]}" -e "INSERT INTO accounts(username,username_normalized,email,email_normalized,password_hash) VALUES('Alice','alice','A@Example.com','a@example.com','hash')"
if "${client[@]}" -e "INSERT INTO accounts(username,username_normalized,email,email_normalized,password_hash) VALUES('ALICE','alice','b@example.com','hash')" >/dev/null 2>&1; then echo '[db-test] duplicate username was accepted' >&2; exit 1; fi
if "${client[@]}" -e "INSERT INTO accounts(username,username_normalized,email,email_normalized,password_hash) VALUES('Bob','bob','a@example.com','hash')" >/dev/null 2>&1; then echo '[db-test] duplicate email was accepted' >&2; exit 1; fi

account_id="$("${client[@]}" -e "SELECT id FROM accounts WHERE username_normalized='alice'")"
"${client[@]}" -e "INSERT INTO players(account_id,sex,model) VALUES($account_id,'male','a_m_m_bevhills_02')"
"${client[@]}" -e "INSERT INTO sessions(id,account_id,server_source) VALUES(UUID(),$account_id,1)"
if "${client[@]}" -e "INSERT INTO sessions(id,account_id,server_source) VALUES(UUID(),$account_id,2)" >/dev/null 2>&1; then echo '[db-test] duplicate active session was accepted' >&2; exit 1; fi

"${client[@]}" -e "INSERT INTO sanctions(sanction_type,target_account_id,target_username,actor_username,reason,expires_at) VALUES('ban',$account_id,'Alice','CONSOLE','expired',UTC_TIMESTAMP()-INTERVAL 1 SECOND),('ban',$account_id,'Alice','CONSOLE','active',UTC_TIMESTAMP()+INTERVAL 1 HOUR)"
active_bans="$("${client[@]}" -e "SELECT COUNT(*) FROM sanctions WHERE target_account_id=$account_id AND sanction_type='ban' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP())")"
[[ "$active_bans" == '1' ]] || { echo "[db-test] expected one active temporary ban, got $active_bans" >&2; exit 1; }

count="$("${client[@]}" -e 'SELECT COUNT(*) FROM schema_migrations')"
[[ "$count" == '4' ]] || { echo "[db-test] expected 4 migrations, got $count" >&2; exit 1; }
echo '[db-test] fresh migrations, repeat safety, FKs, and unique constraints passed'
