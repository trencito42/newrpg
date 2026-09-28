#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

mapfile -t migrations < <(find database/migrations -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.sql' -printf '%f\n' | sort)
if ((${#migrations[@]} == 0)); then echo '[audit] no migrations' >&2; exit 1; fi
duplicates="$(printf '%s\n' "${migrations[@]}" | cut -c1-3 | sort | uniq -d)"
if [[ -n "$duplicates" ]]; then echo "[audit] duplicate migration prefix: $duplicates" >&2; exit 1; fi

if rg -n --glob '*.lua' --glob '*.js' '(password\s*[=:].*print|print\(.*password|console\.log\(.*password)' resources; then
  echo '[audit] possible password logging found' >&2; exit 1
fi

if rg -n --glob '*.lua' 'MySQL\.(query|single|scalar|update|insert)\.await\([^\[]*\.\.' resources; then
  echo '[audit] possible dynamic SQL concatenation found' >&2; exit 1
fi

for name in jobs factions inventory houses businesses crime clans missions crafting phone casino; do
  if find 'resources/[framework]/rpg_core' -type f \( -name '*.lua' -o -name '*.js' \) -print0 | xargs -0 rg -ni "\\b${name}\\b"; then
    echo "[audit] gameplay domain leaked into core: $name" >&2; exit 1
  fi
done

echo '[audit] migration, secret, SQL, and core-boundary checks passed'

