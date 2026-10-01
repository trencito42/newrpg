# Localization report - 2026-10-01

Status: PARTIALLY VERIFIED (static checks pass; no live FiveM test).

## Counts
- Audit scanner findings: 529 at baseline -> 389 now (-140; includes churn from other agents' concurrent edits).
- Hardcoded strings migrated by this pass (approx.): 112 call sites in Lua (hints, licenses tests, fishing shop, dealership, missions, jobs hints, tuning menus, pass announcements) + ~120 NUI literals (tuning panel, casino, MDC, phone, helpdesk, trucker, fishing, clans) + 94 item names.
- Keys per language: Lua EN 2130 -> 2259, RO 2130 -> 2259; NUI EN 1737 -> 2024, RO 1737 -> 2024 (check-locales: 0 missing, 0 empty, 0 placeholder mismatches, 0 duplicates).
- Mismatches fixed: 136 RO values identical to EN in NUI catalogue; 10 EN values that were Romanian (e.g. Proprietar, Retragere, Girar); 1 missing key (`ui.menu.level_1`).
- Hint wording: ~30 locale strings changed to bracketed keys; 12 code hints moved to `hint.*` keys.

## Remaining (not migrated)
- ~700 `notify(...)` / callback-error / `err or '...'` literals across ~60 resources (admin commands, factions, clans, vehicles, robbery, dispatch...). A scripted codemod was prepared and dry-run (716 call sites, 634 new keys) but the mass rewrite was blocked by the permission classifier; needs owner approval or a per-resource run.
- Jobs HUD fields (counter/message/detail), mission/license config `label/title/message` in shared configs (factions, jobs_*, crafting, licenses, racing), police config charge lists from server, `sunset_devtools` (staff tool, 39 findings), item descriptions.
- Per-frame `exports.sunset_core:Translate` in hint loops (jobs/casino): acceptable but flag for client-perf review.
- Concatenated translated prefix + label (e.g. `jobs.message.you_are_now_employed_as` .. job) is grammar-fragile in RO.

## Intentionally left
Proper names (Billy Ray, LS Customs, Harmony Tuning, mission/place names), chat badges PM/SMS/ME/DO/OOC, clan tag format examples, dev-preview mock data (sunset_pass web mock, battlepass.js placeholders), log lines and staff Discord embeds, key-cap labels (ENTER).

## Live visual checks needed
RO overflow candidates (23 listed by `node scripts/check-locale-usage.js`, longest ~160 chars NUI devtools), tuning panel labels, ATM/HUD uppercase RO labels (e.g. "BUNURILE TALE", "CENTURĂ DESFĂCUTĂ"), 3D hint width, loadscreen tips, two-client EN/RO switching.

## Verification run
check-lua-syntax 419/419 OK; check-locales OK; check-locale-usage OK; test-localization OK; node --check on all edited JS OK.
