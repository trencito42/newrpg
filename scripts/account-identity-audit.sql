-- READ-ONLY account ownership diagnostics. This script never changes or deletes
-- player data. Shared licenses are reported as security context, not corruption.

-- Accounts without a canonical player profile.
SELECT a.id AS account_id, a.username, a.created_at
FROM accounts a
LEFT JOIN players p ON p.account_id = a.id
WHERE p.id IS NULL
ORDER BY a.id;

-- Player profiles without a valid account.
SELECT p.id AS player_id, p.account_id, p.license, p.name, p.created_at
FROM players p
LEFT JOIN accounts a ON a.id = p.account_id
WHERE p.account_id IS NULL OR a.id IS NULL
ORDER BY p.id;

-- Ambiguous duplicate profiles. Resolve manually before migration 76 installs
-- uq_players_account_id. Never choose a winner based on license alone.
SELECT p.account_id, a.username, COUNT(*) AS player_rows,
       GROUP_CONCAT(p.id ORDER BY p.id) AS player_ids,
       MIN(p.created_at) AS first_profile_at,
       MAX(p.created_at) AS last_profile_at
FROM players p
LEFT JOIN accounts a ON a.id = p.account_id
WHERE p.account_id IS NOT NULL
GROUP BY p.account_id, a.username
HAVING COUNT(*) > 1;

-- Orphaned characters (normally prevented by the foreign key).
SELECT c.id AS character_id, c.player_id, c.firstname, c.lastname, c.created_at
FROM characters c
LEFT JOIN players p ON p.id = c.player_id
WHERE p.id IS NULL
ORDER BY c.id;

-- Investigation report for profiles sharing a device. This is valid by itself;
-- inspect only when timestamps/support evidence suggest prior reassignment.
SELECT p.license,
       COUNT(DISTINCT p.account_id) AS account_count,
       GROUP_CONCAT(CONCAT('player=', p.id, ',account=', COALESCE(p.account_id, 0),
                           ',username=', COALESCE(a.username, '?'))
                    ORDER BY p.id SEPARATOR ' | ') AS profiles,
       MIN(p.created_at) AS first_seen_at,
       MAX(p.last_seen) AS last_seen_at
FROM players p
LEFT JOIN accounts a ON a.id = p.account_id
WHERE p.license IS NOT NULL AND p.license <> ''
GROUP BY p.license
HAVING COUNT(DISTINCT p.account_id) > 1;

-- Complete reconciliation export. Ownership candidates remain intentionally
-- blank unless independent provenance is available to an administrator.
SELECT p.id AS player_id,
       p.account_id AS current_account_id,
       a.username AS current_username,
       NULL AS possible_original_account_id,
       NULL AS possible_original_username,
       p.license,
       p.created_at AS player_created_at,
       GROUP_CONCAT(CONCAT(c.id, ':', c.firstname, ' ', c.lastname)
                    ORDER BY c.id SEPARATOR ' | ') AS characters,
       CASE
           WHEN p.account_id IS NULL THEN 'player_without_account'
           WHEN a.id IS NULL THEN 'missing_account'
           ELSE 'shared_device_review_only'
       END AS reason_flagged
FROM players p
LEFT JOIN accounts a ON a.id = p.account_id
LEFT JOIN characters c ON c.player_id = p.id
GROUP BY p.id, p.account_id, a.username, p.license, p.created_at, a.id
HAVING reason_flagged <> 'shared_device_review_only'
    OR p.license IN (
        SELECT license FROM players WHERE license IS NOT NULL AND license <> ''
        GROUP BY license HAVING COUNT(DISTINCT account_id) > 1
    )
ORDER BY p.id;
