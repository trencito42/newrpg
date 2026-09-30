# Localization audit

## Initial finding

The implementation found on the current HEAD was **BROKEN** for the requested use case:

- language selection was global, not per player;
- Romanian inherited English and contained no real translations;
- the translation helper had no real production call sites;
- no language preference was persisted;
- no NUI translator or live language switch existed;
- server callbacks and broadcasts returned pre-rendered English text.

Documentation describing global switching did not match the requirement.

## Current migration status

The architecture is now per-player and the migrated dictionaries have full EN/RO parity, but the repository-wide text migration is still **PARTIAL**. The latest broad pass scanned 621 files and reported 3,012 likely player-facing literals. The count deliberately errs on the side of false positives and increased after the scanner was taught to recognize lowercase `notify`/`uiNotify` calls and outbound notification events.

Completed presentation boundaries include the core locale lifecycle, account persistence, live M-menu selector, chat shell/system messages, property UI and primary property callbacks, dedicated authentication UI, and the shared 24/7/fishing-store surface. No complete status or production deployment is permitted until the remaining findings are classified or migrated and the manual module-by-module pass is recorded.

## Inventory method

The audit covers every `.lua`, `.js`, `.html`, `.json`, and `.css` file below `resources/[sunset]`. Searches include notification APIs, callback error returns, chat messages, GTA text natives, dynamic DOM writes, template literals, HTML text/attributes, and CSS `content`. Debug logs, SQL, identifiers, event names, model names, SVG paths, and developer comments are exclusions.

`scripts/audit-localization.js` is the repeatable first pass; manual inspection remains required because regular expressions cannot determine presentation context reliably. Intentional literals use an adjacent `i18n-ignore` annotation and must be listed in the final report.

## Verification gates

- `scripts/check-locales.js`: duplicate, missing, empty, and placeholder parity validation for Lua and NUI dictionaries.
- `scripts/audit-localization.js`: likely hardcoded player-facing strings.
- `scripts/check-lua-syntax.js`: all Lua resources.
- `node --check`: changed JavaScript.
- `scripts/check-nui-bridge.js` and `scripts/check-nui-modules.js`: NUI transport and module contract.

Live acceptance still requires two simultaneous clients (EN + RO), reconnect persistence, and switching each major open panel in both directions without a reload.
