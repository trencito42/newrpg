#!/bin/sh
# Build and restart the Next.js panel (racket.cat). Run from repo root after git pull.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR/panel"

export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$(pwd)/.npm-cache}"
mkdir -p "$NPM_CONFIG_CACHE"

if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
fi

if [ ! -d node_modules/next ]; then
  echo "[panel] installing deps..."
  npm ci
fi

echo "[panel] production build..."
npm run build

chmod +x scripts/start-prod.sh

if command -v pm2 >/dev/null 2>&1; then
  echo "[panel] (re)starting pm2 rpg-panel via start-prod.sh..."
  pm2 delete rpg-panel 2>/dev/null || true
  pm2 start scripts/start-prod.sh --name rpg-panel --cwd "$DIR/panel" --interpreter bash
  pm2 save 2>/dev/null || true
else
  echo "[panel] pm2 not found — build complete; start manually with: cd panel && ./scripts/start-prod.sh"
fi

echo "[panel] deploy done ($(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || echo unknown))"
