#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

bash scripts/bootstrap-test-tools.sh
npm install --ignore-scripts --no-audit --no-fund
npm test

while IFS= read -r -d '' file; do .tools/lua/bin/luac -p "$file"; done < <(find 'resources/[framework]' -name '*.lua' -print0)
.tools/lua/bin/lua tests/lua/command_spec.lua
.tools/lua/bin/lua tests/lua/rpc_spec.lua

npm --prefix 'resources/[framework]/rpg_ui/web' install --ignore-scripts --no-audit --no-fund
npm --prefix 'resources/[framework]/rpg_ui/web' run build

env FIVEM_LICENSE_KEY='' FIVEM_PORT=30120 MYSQL_DATABASE=rpgmvp MYSQL_USER=rpgmvp MYSQL_PASSWORD=test MYSQL_ROOT_PASSWORD=test docker compose config --quiet

bash scripts/static-audit.sh
echo '[validate] all non-database checks passed'

