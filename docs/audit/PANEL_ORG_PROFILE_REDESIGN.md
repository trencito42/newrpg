# Panel organization profile redesign

Date: 2026-10-07

## Schema

- `sql/97-panel-org-profiles.sql` — `panel_org_profiles` (`org_type`, `org_id`, cover, description EN/RO overrides, rules EN/RO Markdown).

## API

- `GET/PATCH /api/organizations/[type]/[id]/profile` — public read; PATCH authorized via `canManageOrganization()` (server-side).
- Audit: `organization_profile_update`, `organization_cover_update`, `organization_rules_update` in `panel_audit_log`.

## Shared UI

- `panel/src/components/organizations/` — `OrganizationCover`, `OrganizationHero`, `OrganizationTabs`, `OrganizationApplicationsPanel`, `OrganizationRulesPanel`, `OrganizationProfileEditor`.
- `panel/src/lib/org-profile.ts`, `org-management-permissions.ts`, `org-applications-public.ts`, `org-tabs.ts`.

## Routes

- `/factions/[slug]` — tabs via `?tab=` (overview, members, applications, rules, ranks if `faction_grade_labels` exist).
- `/clans/[id]` — overview, members, applications, rules, turfs.
- Manage: **Profile** tab on faction/clan manage panels.

## Cover

- Optional HTTPS URL; fallback surfaces (faction tint by slug, clan tag watermark).
- Broken image → fallback via `onError`.

## Applications (public tab)

- Reuses `panel_org_application_settings`, `panel_org_application_questions`, viewer row from `panel_org_applications` only.
- Effective min level `max(10, settings.min_level)` for factions.
- No public list of other applicants.

## Rules

- Markdown via `MarkdownDocument` / `MarkdownRenderer` (sanitized).
- Empty state + link to `/rules`.

## Permissions

- Same as existing manage gates (`canManageOrganization` mirrors public Manage button logic).

## Mobile

- Hero stacks identity below cover on small screens; tab bar `overflow-x-auto` local; tables use `responsive-table-wrapper`.

## Confirmations

- Existing application backend reused — no second system.
- Organization rules are sanitized Markdown only.
- Cover/rules edits server-authorized.
- No new global design system; uses existing RACKET shell and surfaces.
