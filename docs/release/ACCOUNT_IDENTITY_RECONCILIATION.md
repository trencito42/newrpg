# Account identity reconciliation

Account ownership follows `accounts.id → players.account_id → characters.player_id`.
FiveM licenses are device metadata. Several accounts may legitimately share one
license, and one account may be observed from several licenses.

Before applying `sql/76-account-identity-isolation.sql`, run the read-only
`scripts/account-identity-audit.sql` against a database backup. Export every
result set and record the review decision in the support case.

The migration removes global license uniqueness and adds uniqueness to
`players.account_id`. If duplicate player profiles already exist for an account,
that constraint fails deliberately. Do not delete characters, merge profiles,
or reassign ownership based only on a shared license.

For an ambiguous row, use independent provenance such as account creation time,
historical authentication logs, support records, character creation evidence,
or a confirmation from the verified account owner. Move ownership only in an
explicit maintenance transaction after backing up every affected row and its
character-owned tables. Preserve the original IDs and keep the exported audit
with the recovery record.

Recovery consists of restoring the database backup or reversing the explicitly
documented ownership update. Migration 76 does not delete or merge data.
