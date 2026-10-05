#!/bin/sh
# PM2 / production start: ensure .next exists so first launch does not exit immediately.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .next/BUILD_ID ]; then
  echo "[rpg-panel] missing production build — running npm run build..."
  npm run build
fi

exec npm start
