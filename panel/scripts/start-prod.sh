#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
fi

NEXT_BIN="$(pwd)/node_modules/.bin/next"
if [ ! -x "$NEXT_BIN" ]; then
  echo "[rpg-panel] installing dependencies..."
  export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$(pwd)/.npm-cache}"
  mkdir -p "$NPM_CONFIG_CACHE"
  npm ci
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "[rpg-panel] building production bundle..."
  npm run build
fi

exec "$NEXT_BIN" start -p 3000
