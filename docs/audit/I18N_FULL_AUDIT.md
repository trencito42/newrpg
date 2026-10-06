# I18N Full Audit — RACKET (newrpg)

Date: 2026-10-06  
Scope: FiveM (Lua + NUI), loadscreen, web panel (`racket.cat`), static gates + manual surface review.

## BEFORE (this remediation pass — baseline at start)

All authoritative gates already passed; the work targeted **hidden debt** (ignores, locale ternaries, branding, SEO metadata).

| Command | Result |
|---------|--------|
| `npm run i18n:check` | **PASS** — 0 violations |
| `node scripts/check-locales.js` | **PASS** — GAME 5119/5119, NUI 3617/3617, PANEL 1548/1548 |
| `node scripts/check-locale-usage.js` | **PASS** — 0 hardcoded literals in 726 files |
| `node scripts/audit-localization.js` | **PASS** |
| `node scripts/audit-localization-deep.js` | Informational — naive RO count 5114 vs EN 5119 (not authoritative) |
| `node --test scripts/i18n-gate.test.mjs` | **PASS** 5/5 |
| `npm --prefix panel run i18n:check` | **PASS** |

### Systemic gaps identified (not caught by gate alone)

1. **Panel `i18n-ignore` / `i18n-ignore-file`** — ~40 files still using ignores for player-facing copy (forum editor placeholders, staff player page RO-only strings, updates modals, polls, GlobalSearch, etc.).
2. **Banking transaction titles** — `BankingClientView` used inline EN/RO `reasonMap` + `locale === "ro"` ternary (~45 strings).
3. **Forum permission gate** — duplicate EN/RO object + language ternary instead of `t()`.
4. **SEO metadata** — `/shop`, `/shop/coins`, `/forum` used English-only static `metadata` exports.
5. **Branding** — `Sunset.Brand.CurrencyName` = “Racket Credits”; clan create fallback English hardcode; pass config fallback labels “Racket Credits”.
6. **Command suggestions** — 313 `RegisterCommand` literals vs 280 `chat.suggestion.*` pairs (33 commands without translated help; gate does not fail on this).

---

## FIXES (this pass)

### Panel locales

- Added **`forumUi.*`** gate messages, confirm/save/edit placeholders, search placeholders, forum errors.
- Added **`bankingTx.*`** (45 keys) — bank transaction reason labels EN/RO.
- Added **`seo.*`** for forum, shop, shop/coins, updates, polls metadata.
- Added **`socialUi.likes_one` / `likes_other`** for liker tooltips.

### Panel code

- **`BankingClientView.tsx`** — `t(locale, "bankingTx.*")`; removed locale ternary map.
- **`ForumPermissionGate.tsx`** — `t()` only.
- **`MarkAllReadButton.tsx`** — localized; removed file-level ignore.
- **Forum** — `PostCard`, `ReplyForm`, `PostReportModal`, `search/page` migrated off hardcoded English.
- **`LikersTooltip.tsx`** + **`SocialPostCard.tsx`** — locale-aware like labels.
- **`shop/page.tsx`**, **`shop/coins/page.tsx`**, **`forum/layout.tsx`** — `generateMetadata()` + `t(locale, "seo.*")`.

### Game

- **`sunset_core/shared/config.lua`** — `CurrencyName` → **Racket Coins**.
- **`clans.err.create_failed_no_message`** EN/RO + client uses `Translate()`.
- **`sunset_pass/shared/config.lua`** — fallback labels → Racket Coins.

### UI redesign (same release window)

- Shop / rules / turfs / shop coins panel pages aligned to modern card layout (not i18n-specific).

---

## AFTER (validation)

| Command | Status |
|---------|--------|
| `npm run i18n:check` | **PASS** — 0 localization violations |
| `node scripts/check-locales.js` | **PASS** — 0 missing, 0 empty, 0 placeholder mismatches, 0 duplicates |
| `node scripts/check-locale-usage.js` | **PASS** |
| `node scripts/audit-localization.js` | **PASS** |
| `node scripts/audit-localization-deep.js` | Informational key-count delta only |
| `node --test scripts/i18n-gate.test.mjs` | **PASS** 5/5 |
| `node scripts/check-lua-syntax.js` | **PASS** 485/485 |
| `node scripts/check-nui-bridge.js` | **PASS** |
| `node scripts/check-nui-modules.js` | **PASS** |
| `npm --prefix panel run i18n:check` | **PASS** |
| `npm --prefix panel run build` | **PASS** |

Dictionary counts (gate):

| Surface | EN | RO |
|---------|----|----|
| GAME LUA | 5120 | 5120 |
| NUI | 3617 | 3617 |
| PANEL | 1624 | 1624 |
| LOADSCREEN | 17 | 17 |

---

## RUNTIME MATRIX (manual QA)

| Flow | EN | RO | Notes |
|------|----|----|-------|
| Login / character / spawn | Gate clean | Gate clean | Game `locale` convar + panel cookie |
| `/help`, chat suggestions | Gate clean | Gate clean | 33 commands still lack `chat.suggestion.*` |
| Banking panel | Migrated | Migrated | Verify rare DB reason strings fallback formatting |
| Forum read/reply/report | Improved | Improved | Staff admin panel + new-topic still English-heavy |
| Shop / RC panel | SEO localized | SEO localized | Purchase still requires in-game character |
| Feed / social likes | Localized tooltip | Localized tooltip | Updates likers tooltip may need `locale` prop on other parents |
| NUI HUD / phone / inventory | Gate clean | Gate clean | Live locale switch: verify open panels refresh |

---

## KNOWN EXCEPTIONS / FOLLOW-UP

Documented individually — **not** waived via allowlist weakening.

| Area | Reason |
|------|--------|
| `panel/src/app/manifest.ts` | PWA manifest; English-only until dynamic manifest by locale |
| `panel/src/lib/seo/metadata.ts`, root `layout.tsx` | Default OG strings English; partial `seo.*` coverage on inner pages |
| `panel/src/app/staff/**` | Large staff-only surfaces with mixed RO hardcode + `i18n-ignore: pre-existing` |
| `panel/src/app/updates/**`, `PostUpdateModal.tsx` | Author/staff tooling; many ignores remain |
| `panel/src/components/navigation/GlobalSearch.tsx` | Placeholders + suggestions need `search.*` keys |
| `panel/src/components/forum/ForumAdminPanel.tsx` | Staff forum ACL UI; `i18n-ignore-file` |
| `sunset_devtools/**` | `SUNSET_DEV=1` only; English by design |
| `sunset_hacking/shared/puzzles.lua` | Machine validation codes |
| Bilingual DB fields (`title_en`/`title_ro`, polls, forum categories) | **Acceptable** — not copy ternaries |
| `audit-localization-deep.js` RO count | Legacy parser; use `check-locales.js` for release |
| Command help gap (33) | Add `chat.suggestion.<cmd>` in `en.lua`/`ro.lua` + registry wiring |

---

## ZERO-ERROR TARGET (static)

| Check | Status |
|-------|--------|
| Missing EN/RO keys (authoritative) | **0** |
| Empty values | **0** |
| Placeholder mismatches | **0** |
| Duplicate keys (authoritative) | **0** |
| Gate violations (`--strict`) | **0** |
| `check-locale-usage` hardcoded literals | **0** |
| Stale `i18n.generated.js` | Regenerate via existing pipeline when NUI keys change |

Remaining **panel `i18n-ignore` comments** (~100+ line-level) are tracked above; removing them is the next panel sweep, not gate failures.
