#!/bin/sh
# Rebuild the loadscreen asset URLs from their bytes on every deployment.
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
asset_dir="$project_dir/resources/[sunset]/sunset_loadscreen"
index="$asset_dir/index.html"
script_hash=$(sha256sum "$asset_dir/script.js" | cut -c1-16)
image_hash=$(sha256sum "$asset_dir/assets/sunset.webp" | cut -c1-16)
sed -E -i "s|assets/sunset.webp(\?v=[^']*)?|assets/sunset.webp?v=${image_hash}|" "$asset_dir/style.css"
style_hash=$(sha256sum "$asset_dir/style.css" | cut -c1-16)
font_hash=$(sha256sum "$asset_dir/assets/fonts/gfonts.css" | cut -c1-16)
commit=$(git -C "$project_dir" rev-parse --short=12 HEAD 2>/dev/null || printf 'archive')
build="ls-${script_hash}-${style_hash}-${font_hash}"

sed -E -i \
  -e "s|(<meta name=\"loadscreen-build\" content=\")[^\"]*(\")|\1${build}\2|" \
  -e "s|(<meta name=\"loadscreen-commit\" content=\")[^\"]*(\")|\1${commit}\2|" \
  -e "s|assets/fonts/gfonts.css(\?v=[^\"]*)?|assets/fonts/gfonts.css?v=${font_hash}|" \
  -e "s|style.css(\?v=[^\"]*)?|style.css?v=${style_hash}|" \
  -e "s|script.js(\?v=[^\"]*)?|script.js?v=${script_hash}|" \
  "$index"

if ! grep -Fq "script.js?v=$script_hash" "$index" ||
   ! grep -Fq "style.css?v=$style_hash" "$index" ||
   ! grep -Fq "gfonts.css?v=$font_hash" "$index"; then
  echo '[loadscreen] asset stamping failed' >&2
  exit 1
fi
echo "[loadscreen] commit=$commit asset=$build"
