# Panel mobile responsiveness audit

Date: 2026-10-06  
Scope: entire RACKET panel (`panel/`).

## Mobile responsiveness audit

### iOS input auto-zoom (fixed at source)

**Cause:** Safari zooms when focusing `input` / `select` / `textarea` with computed font-size &lt; ~16px. Many RACKET controls use `text-xs` / `text-[11px]` on desktop.

**Fix:** Global rule in `panel/src/app/globals.css` (max-width 767px):

- `input` (except checkbox, radio, range, hidden, file), `select`, `textarea` → `font-size: 16px !important`
- Labels, helper text, and table chrome remain compact; only editable control text is enlarged on phones.

**Not used:** `user-scalable=no`, `maximum-scale=1`, viewport JS hacks, `transform: scale()` on the app, or disabling pinch zoom.

**Viewport:** `panel/src/app/layout.tsx` keeps `maximumScale: 5` and `initialScale: 1` — manual accessibility zoom remains available.

### Text size stability

Added on `html`:

```css
-webkit-text-size-adjust: 100%;
text-size-adjust: 100%;
```

Prevents unexpected browser text rescaling without blocking user zoom.

### Route / shell stability

- `RouteScrollReset` (`panel/src/components/navigation/RouteScrollReset.tsx`) resets scroll position and horizontal drift on pathname change.
- Shell already uses `min-w-0` on the main column (`layout.tsx`); `body` uses `min-height: 100dvh` (with `100vh` fallback).

### Fixed-width controls made responsive

| Location | Change |
|----------|--------|
| `staff/audit/page.tsx` | Search field `w-full sm:w-60`; form stacks on mobile |
| `staff/players/page.tsx` | Search `w-full sm:w-64`; stacked header actions |
| `clans/page.tsx` | Search + submit stack; full-width input |
| `forum/search/page.tsx` | Primary search row `flex-col sm:flex-row`; filters `grid-cols-1 sm:2 lg:3` |

Other pages already used `w-full sm:w-*` (e.g. `players/page.tsx` search).

### Non-responsive grids corrected

| Location | Change |
|----------|--------|
| `ForumStaffAdmin.tsx` | Create category/forum rows: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-[…_auto]` instead of fixed `grid-cols-[1fr_1fr_1fr_auto]` on all breakpoints |
| `RulesStaffClient.tsx` | Rules list header: `flex-col sm:flex-row` |

Wiki staff layout (`lg:grid-cols-[240px_1fr]`) already collapses to one column below `lg`.

### Modal viewport / keyboard

Replaced static `vh` max-heights with `dvh` where modals/sheets size against the visible viewport:

- `CreatePollModal`, `PostUpdateModal` → `max-h-[92dvh]`
- `PlayerAdminManage` modal → `max-h-[90dvh]`
- `SocialGalleryPicker` → `max-h-[80dvh]`
- `VehicleProfileTrigger` (mobile sheet / desktop popover) → `88dvh` / `85dvh`
- `GalleryClient` lightbox image → `max-h-[80dvh]`

Modal bodies that already use `overflow-y-auto` / flex column layouts were left intact.

### Horizontal overflow

- `overflow-x: hidden` on `html, body` is unchanged; it hides accidental page-wide overflow but does not fix root causes.
- `.responsive-table-wrapper` now includes `max-width: 100%`.
- Intentional horizontal scrollers tagged with `data-scroll-x="local"` and `max-w-full`: home carousels, shop category strip, staff audit category pills, `HomeCommunitySlider`.
- `VehicleProfileTrigger` desktop width: `calc(100%-16px)` instead of `100vw` to avoid scrollbar-width quirks.

**Tables:** Wide staff/clan/faction tables keep `overflow-x-auto` on their card wrappers; players directory uses `.responsive-table-wrapper`. No whole-page horizontal scroll intended.

### Touch targets

- `MobileNav` menu and drawer close: `min-h-[44px] min-w-[44px]`.
- Header search submit buttons on audit/clans/staff players/forum search: `min-h-[44px]` on mobile, compact on `sm+`.

### Page headers

- Convention documented in `PANEL_DESIGN_CONSISTENCY.md`; reusable `PanelPageHeader` added for new work.
- Existing routes largely use `flex flex-col sm:flex-row sm:items-center justify-between`; this pass tightened search-heavy headers listed above.

### Intentional horizontal scrollers (retained)

- Home stat/update carousels (`page.tsx`)
- `HomeCommunitySlider`
- Shop category tabs (`ShopClientView`)
- Staff audit category pill row
- Forum/shop patterns using local `overflow-x-auto` only

### Repository sweep (post-fix review)

Patterns still present by design — review before changing:

| Pattern | Notes |
|---------|--------|
| `text-xs` on `input` in TSX | Overridden to 16px on mobile via global CSS; desktop unchanged |
| `w-64` / `md:w-72` with `w-full` prefix | OK (players, updates feed) |
| `grid-cols-2` on stats/faction tiles | Acceptable at 320px with gap; not form grids |
| `100vw` | Removed from vehicle popover; no new `w-screen` introduced |
| `min-w-[120px]` on forum topic meta | Desktop-only (`hidden md:flex`) |
| Modal `fixed inset-0` | Standard overlay; height uses `dvh` on inner panel where listed |

### Acceptance criteria (summary)

| Phone | Desktop |
|-------|---------|
| No Safari focus auto-zoom on text controls | Compact `text-xs` inputs unchanged |
| Stable scale after blur / navigation | No global 16px rule |
| No accidental body horizontal scroll | — |
| Modals usable with keyboard (`dvh`) | Same modal widths |
| Pinch zoom still allowed (`maximumScale: 5`) | — |

### Verification

```bash
npm --prefix panel run build
```

Manual Safari flow (items 65 in spec): `/players`, `/clans`, `/forum/search`, `/support/tickets`, `/account`, `/staff/players`, `/staff/audit`, `/staff/forum`, `/staff/content` — focus search/select, navigate away, confirm no zoom drift.
