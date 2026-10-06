# Panel design consistency audit

Date: 2026-10-06  
Scope: `panel/src/app/**` layout width, padding, headers (visual alignment pass).

## Global width policy

- **Canonical shell:** `panel/src/app/layout.tsx` → `<main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1560px] w-full mx-auto">`
- **Normal pages** use `w-full` + `space-y-4` at the page root. No extra `max-w-* mx-auto` or duplicate `px-*` on the outer page.
- **Reading columns:** long-form content may use an **inner** `max-w-3xl` (or feed `max-w-[680px]`) without centering the whole page.
- **Functional narrow UI:** login/reset (`max-w-md`), modals, checkout success card, staff “access restricted” card — unchanged.

## Page header convention (normalized where touched)

- `text-xl font-bold text-[#F2EFE8] tracking-tight`
- `pb-2` under header block
- Optional subtitle: `mt-1 text-xs text-[#99958E]` or `text-[#8F8B83]`

## Accidental outer max-width removed

| Route / file | Change |
|--------------|--------|
| `forum/layout.tsx` | Removed `max-w-5xl mx-auto px-4` |
| `rules/page.tsx` | Outer `w-full`; rules list `max-w-3xl` inner |
| `feed/page.tsx` | Header full width; timeline `max-w-[680px]` inner (no `mx-auto`) |
| `account/page.tsx` | Removed outer `max-w-3xl`; header aligned to `text-xl` |
| `my-character/licenses/page.tsx` | Removed outer `max-w-3xl` |
| `support/complaints/page.tsx` | Removed `max-w-6xl mx-auto` |
| `support/complaints/[id]/ComplaintThreadClient.tsx` | Removed `max-w-5xl mx-auto` |
| `support/tickets/[id]/page.tsx` | Removed outer `max-w-3xl` |
| `clans/[id]/applications/page.tsx` | Removed `max-w-6xl mx-auto` |
| `factions/[slug]/applications/page.tsx` | Removed `max-w-6xl mx-auto` |
| `wiki/WikiHomeClient.tsx` | Removed outer `max-w-4xl` |
| `wiki/category/[slug]/page.tsx` | Full-width listing |
| `shop/coins/CoinsClientView.tsx` | Full width; package grid `max-w-3xl` inner |

## Intentional inner width retained

| Route | Inner constraint | Reason |
|-------|------------------|--------|
| `/feed` | `max-w-[680px]` | Timeline reading column |
| `/rules` | `max-w-3xl` on rule cards | Readable rule text |
| `/wiki/[slug]`, legal pages | `max-w-3xl` on `MarkdownDocument` | Long-form prose |
| `/forum/new-topic/*` | `max-w-3xl` on editor form | Form/editor column |
| `/factions|clans/.../apply` | `max-w-2xl` form column | Application form |
| `/shop/coins` | `max-w-3xl` on package grid | Checkout cards, not full-bleed |
| Auth routes | `max-w-md` | Login/password forms |
| `/shop/coins/success` | `max-w-lg` card | Confirmation card |

## Duplicated padding removed

- Forum layout no longer adds `px-4` inside global `main` padding.

## Deliberate exceptions (unchanged)

- Truncation utilities (`max-w-xs`, `max-w-sm` on table cells) — not page layout.
- Modals/dialogs in staff clients (`max-w-md`, `max-w-lg`, `max-w-2xl`).
- Faction detail hero subtitle `max-w-2xl` — typography line length inside hero, not page shell.
- `updates/PostUpdateModal` — modal width.

## Spacing / surfaces

- Wiki home: `space-y-6` → `space-y-4` to match dominant page rhythm.
- No global card/token redesign; existing `bg-[#0E0E10]`, `rounded-xl`, `bg-surface-100` patterns kept.

## Verification

After changes, remaining `max-w-*` on `panel/src/app/**/page.tsx` are inner columns or auth/success flows only.

Build: run `npm --prefix panel run build` before deploy.

## Page header component

For new pages, prefer `PanelPageHeader` (`panel/src/components/ui/PanelPageHeader.tsx`): title/description stack on mobile; actions full-width column below `sm`, row aligned on desktop.

## Mobile responsiveness

See `docs/audit/PANEL_MOBILE_RESPONSIVENESS.md` for iOS input zoom, overflow, modals, and acceptance criteria.
