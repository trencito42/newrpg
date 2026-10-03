# Account identity and FiveM identifiers

`accounts.id` is the login identity. `players.account_id` binds a game profile to that account. Characters belong to the player row. FiveM identifiers, including `license`, describe the connecting session and support security/audit correlation; they do not select or own an account.

`sunset_auth` verifies credentials and calls `CompleteAuthentication(source, accountId)`. Core resolves only the supplied account id. It does not fall back to a license-owned player. One account may have only one authenticated source at a time, while two different accounts may connect through the same FiveM license.

Migration `sql/76-account-identity-isolation.sql` removes the legacy unique-license assumption. Before production, run `scripts/account-identity-audit.sql` on a clone, reconcile ambiguous legacy rows, apply migrations with checksums, then test two valid accounts from one license, reconnect and duplicate login eviction.

Never restore a query that resolves ownership with `WHERE license = ?`, and never add a unique constraint on the license column.
