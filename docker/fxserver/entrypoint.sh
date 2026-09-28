#!/usr/bin/env bash
set -Eeuo pipefail

required=(FIVEM_LICENSE_KEY MYSQL_HOST MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD FIVEM_PORT)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "[RPGMVP] ERROR: required environment variable ${name} is missing" >&2
    exit 64
  fi
done

template="$(cat /opt/rpg/config/server.cfg.template)"
template="${template//@@FIVEM_PORT@@/$FIVEM_PORT}"
template="${template//@@FIVEM_LICENSE_KEY@@/$FIVEM_LICENSE_KEY}"
template="${template//@@SERVER_NAME@@/${SERVER_NAME:-RPG Framework MVP}}"
template="${template//@@MAX_CLIENTS@@/${MAX_CLIENTS:-48}}"
template="${template//@@MYSQL_HOST@@/$MYSQL_HOST}"
template="${template//@@MYSQL_DATABASE@@/$MYSQL_DATABASE}"
template="${template//@@MYSQL_USER@@/$MYSQL_USER}"
template="${template//@@MYSQL_PASSWORD@@/$MYSQL_PASSWORD}"

printf '%s\n' "$template" > /opt/cfx-server-data/server.cfg

exec /opt/fxserver/run.sh +set onesync on +exec server.cfg
