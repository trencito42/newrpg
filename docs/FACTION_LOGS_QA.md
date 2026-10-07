# Faction Logs — manual QA checklist

## Database

- [ ] Migration `99-faction-logs.sql` applies cleanly; `faction_audit_log` is gone; `faction_logs` has historical rows.
- [ ] New in-game action creates a row with `event_type`, name snapshots, and optional reason.

## Permissions (panel)

- [ ] Guest cannot open `/api/organizations/faction/{slug}/logs` (401).
- [ ] Non-member citizen gets 403 on logs API and no Logs tab on faction page.
- [ ] Faction member sees Logs tab and paginated feed.
- [ ] Admin level 3+ can view logs for any faction without membership.

## In-game / bridge (after deploy)

- [ ] `/finvite` + accept → `member_invited` / `member_joined`.
- [ ] Voluntary leave → `member_left`.
- [ ] Kick (with and without FP) → `member_kicked`; FP paths show reason/metadata.
- [ ] Promote/demote (F10 roster and `/fpromote`) → rank events with previous/new grade when available.
- [ ] `/fwarn` → `member_warned` with reason.
- [ ] `/setleader` / `/removeleader` → leadership events.
- [ ] Panel action queue: warn, kick, rank, set member, pardon FP → logs via `WriteFactionLog`.
- [ ] Panel application accept (without add member) → `application_rejected` / `application_accepted` in DB.
- [ ] Panel application accept + add member → `application_accepted` when queue completes (bridge).

## UI

- [ ] Logs tab: filters, search, pagination (25), empty state copy EN/RO.
- [ ] Actor/target names link to player profiles.
- [ ] Mobile layout: horizontal filter scroll, readable feed.
- [ ] Member profile (same faction viewer): Faction history compact block.

## Regression

- [ ] Faction manage panel still shows recent audit rows (40).
- [ ] Weekly faction report activity count still works (`faction_logs` query).
- [ ] Retention job still purges `faction_logs` older than 180 days.
