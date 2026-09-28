#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lua_root="$project_root/.tools/lua"
if [[ -x "$lua_root/bin/lua" && -x "$lua_root/bin/luac" ]]; then exit 0; fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl -fL --retry 4 https://www.lua.org/ftp/lua-5.4.8.tar.gz -o "$work/lua.tar.gz"
tar -xzf "$work/lua.tar.gz" -C "$work"
make -C "$work/lua-5.4.8" linux -j2 >/dev/null
make -C "$work/lua-5.4.8" INSTALL_TOP="$lua_root" install >/dev/null
echo "[tools] Lua 5.4.8 installed at $lua_root"

