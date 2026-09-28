#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

mapfile -t migrations < <(find database/migrations -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.sql' -printf '%f\n' | sort)
if ((${#migrations[@]} == 0)); then echo '[audit] no migrations' >&2; exit 1; fi
duplicates="$(printf '%s\n' "${migrations[@]}" | cut -c1-3 | sort | uniq -d)"
if [[ -n "$duplicates" ]]; then echo "[audit] duplicate migration prefix: $duplicates" >&2; exit 1; fi

# Check for password logging in any resource files
if find resources -type f \( -name '*.lua' -o -name '*.js' -o -name '*.ts' \) -print0 | xargs -0 grep -En '(password\s*[=:].*print|print\(.*password|console\.log\(.*password)' 2>/dev/null; then
  echo '[audit] possible password logging found' >&2; exit 1
fi

# Check for dangerous dynamic SQL concatenation
if find resources -type f -name '*.lua' -print0 | xargs -0 grep -En 'MySQL\.(query|single|scalar|update|insert)\.await\([^\[]*\.\.' 2>/dev/null; then
  echo '[audit] possible dynamic SQL concatenation found' >&2; exit 1
fi

# Check for direct SetNuiFocus calls outside rpg_ui
if find resources/\[framework\] -type f -name '*.lua' ! -path '*/rpg_ui/*' -print0 | xargs -0 grep -En '\bSetNuiFocus(KeepInput)?\b' 2>/dev/null; then
  echo '[audit] SetNuiFocus call found outside rpg_ui' >&2; exit 1
fi

# Check that core remains strictly free of unrequested gameplay domains
for name in jobs inventory businesses crime clans missions crafting phone casino; do
  if find 'resources/[framework]/rpg_core' -type f \( -name '*.lua' -o -name '*.js' \) -print0 | xargs -0 grep -Ewni "${name}" 2>/dev/null; then
    echo "[audit] gameplay domain leaked into core: $name" >&2; exit 1
  fi
done

echo '[audit] migration, secret, SQL, NUI focus, and core-boundary checks passed'
