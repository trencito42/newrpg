#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${ROOT_DIR}/.env"

echo "[SCHEMA] Exporting clean schema to database/schema.sql..."
mariadb-dump \
  -u "${MYSQL_USER}" \
  -p"${MYSQL_PASSWORD}" \
  -h "${MYSQL_HOST:-127.0.0.1}" \
  --no-data \
  --skip-comments \
  --skip-dump-date \
  "${MYSQL_DATABASE}" > "${ROOT_DIR}/database/schema.sql"

echo "[SCHEMA] database/schema.sql updated successfully."
