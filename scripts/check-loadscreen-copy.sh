#!/bin/sh
# Compare the deployment input with the active FiveM resource volume.
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
asset_dir='resources/[sunset]/sunset_loadscreen'
runtime_dir='/config/resources/[sunset]/sunset_loadscreen'

attempt=0
expected_index=$(sha256sum "$asset_dir/index.html" | cut -d ' ' -f 1)
while :; do
  actual_index=$(docker compose exec -T fivem sha256sum "$runtime_dir/index.html" 2>/dev/null | cut -d ' ' -f 1 || true)
  if [ "$actual_index" = "$expected_index" ]; then break; fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "[loadscreen] runtime index did not match deployment input after 30 seconds (expected=$expected_index actual=${actual_index:-missing})" >&2
    exit 1
  fi
  sleep 1
done

for file in index.html script.js style.css assets/fonts/gfonts.css; do
  expected=$(sha256sum "$asset_dir/$file" | cut -d ' ' -f 1)
  actual=$(docker compose exec -T fivem sha256sum "$runtime_dir/$file" | cut -d ' ' -f 1)
  if [ "$expected" != "$actual" ]; then
    echo "[loadscreen] HASH MISMATCH $file input=$expected runtime=$actual" >&2
    exit 1
  fi
  echo "[loadscreen] verified $file sha256=$actual"
done

count=$(docker compose exec -T fivem find /config/resources -type d -name sunset_loadscreen | wc -l)
if [ "$count" -ne 1 ]; then
  echo "[loadscreen] expected one active sunset_loadscreen, found $count" >&2
  exit 1
fi
echo '[loadscreen] exactly one active resource copy verified'
