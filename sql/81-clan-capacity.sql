-- Clan capacity is 25 (base), 50, then 75.
-- Idempotent. Does not delete members and does not lower any clan already at or above 25.
-- Values between the tiers stay where they are. The next purchase is the smallest tier above the current cap.

UPDATE clans
SET max_members = 25
WHERE max_members < 25;

ALTER TABLE clans
    MODIFY max_members INT UNSIGNED NOT NULL DEFAULT 25;
