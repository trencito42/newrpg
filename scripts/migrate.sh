#!/usr/bin/env bash
set -Eeuo pipefail

export MYSQL_PWD="${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
if [[ -n "${MYSQL_SOCKET:-}" ]]; then
  mysql=(mariadb --protocol=socket --socket="$MYSQL_SOCKET" --user="${MYSQL_USER:?MYSQL_USER is required}" --database="${MYSQL_DATABASE:?MYSQL_DATABASE is required}" --batch --skip-column-names)
else
  mysql=(mariadb --protocol=tcp --host="${MYSQL_HOST:-database}" --user="${MYSQL_USER:?MYSQL_USER is required}" --database="${MYSQL_DATABASE:?MYSQL_DATABASE is required}" --batch --skip-column-names)
fi

until "${mysql[@]}" --execute='SELECT 1' >/dev/null 2>&1; do
  echo '[migrate] waiting for MariaDB'
  sleep 2
done

"${mysql[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) NOT NULL PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

locked="$("${mysql[@]}" --execute="SELECT GET_LOCK('rpgmvp_schema_migrations', 60)")"
if [[ "$locked" != "1" ]]; then
  echo '[migrate] could not acquire migration lock' >&2
  exit 1
fi
trap '"${mysql[@]}" --execute="SELECT RELEASE_LOCK('\''rpgmvp_schema_migrations'\'')" >/dev/null 2>&1 || true' EXIT

shopt -s nullglob
migrations_dir="${MIGRATIONS_DIR:-/migrations}"
files=("$migrations_dir"/[0-9][0-9][0-9]_*.sql)
if ((${#files[@]} == 0)); then
  echo '[migrate] no numbered migrations found' >&2
  exit 1
fi

previous=''
for file in "${files[@]}"; do
  version="$(basename "$file" .sql)"
  if [[ -n "$previous" && "$version" < "$previous" ]]; then
    echo "[migrate] ordering error at ${version}" >&2
    exit 1
  fi
  previous="$version"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  applied="$("${mysql[@]}" --execute="SELECT checksum FROM schema_migrations WHERE version='${version}'")"
  if [[ -n "$applied" ]]; then
    if [[ "$applied" != "$checksum" ]]; then
      echo "[migrate] checksum mismatch for already-applied ${version}" >&2
      exit 1
    fi
    echo "[migrate] ${version} already applied"
    continue
  fi

  echo "[migrate] applying ${version}"
  "${mysql[@]}" < "$file"
  "${mysql[@]}" --execute="INSERT INTO schema_migrations (version, checksum) VALUES ('${version}', '${checksum}')"
done

echo '[migrate] schema is current'
