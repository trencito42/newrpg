#!/usr/bin/env bash
set -Eeuo pipefail

required=(FIVEM_LICENSE_KEY MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD FIVEM_PORT)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "[RPGMVP] ERROR: required environment variable ${name} is missing" >&2
    exit 64
  fi
done

sed \
  -e "s|@@FIVEM_PORT@@|${FIVEM_PORT}|g" \
  -e "s|@@FIVEM_LICENSE_KEY@@|${FIVEM_LICENSE_KEY}|g" \
  -e "s|@@SERVER_NAME@@|${SERVER_NAME:-RPG Framework MVP}|g" \
  -e "s|@@MAX_CLIENTS@@|${MAX_CLIENTS:-48}|g" \
  -e "s|@@MYSQL_DATABASE@@|${MYSQL_DATABASE}|g" \
  -e "s|@@MYSQL_USER@@|${MYSQL_USER}|g" \
  -e "s|@@MYSQL_PASSWORD@@|${MYSQL_PASSWORD}|g" \
  /opt/rpg/config/server.cfg.template > /opt/cfx-server-data/server.cfg

exec /opt/fxserver/run.sh +exec server.cfg

