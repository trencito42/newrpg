# SQL Performance Audit — 2026-09-30

---

## Critical: N+1 in `sunset:getProperties`

**File:** `resources/[sunset]/sunset_properties/server/main.lua`
**Severity:** HIGH
**Status:** FIXED

### Root cause

`publicRow(row, char)` called `activeRental(char.id, row.id)` for every row returned by the main query. Each `activeRental` call is a separate `MySQL.single.await(...)` round-trip. With 50 properties that is **51 SQL queries** per `sunset:getProperties` invocation.

`getProperties` was itself called:
1. On every M press (menu open)
2. On every `propertiesChanged` event (broadcast to all players)
3. On every property zone refresh after spawn

### Fix

```lua
-- One query for all the character's active rentals
local function fetchRentedIds(charId)
    local rows = MySQL.query.await(
        'SELECT property_id FROM property_rentals WHERE character_id=? AND active=1',
        { charId }
    ) or {}
    local set = {}
    for _, r in ipairs(rows) do set[tonumber(r.property_id)] = true end
    return set
end
```

`publicRow` now accepts `rentedIds` as an optional third argument. `getProperties` pre-fetches once and passes it to all rows. **Total: 2 queries regardless of property count.**

---

## Pagination: `sunset:getPropertiesPage`

**File:** `resources/[sunset]/sunset_properties/server/main.lua`
**Severity:** MEDIUM — scalability
**Status:** IMPLEMENTED

The `getProperties` callback was sending ALL enabled properties to NUI every time. With 200+ properties this is a large JSON payload and forces full client-side rendering.

### New callback

```
sunset:getPropertiesPage(opts) → { rows, total, page, totalPages }
```

- `opts.page` — 1-based page number
- `opts.pageSize` — rows per page (1–50, default 20)
- `opts.search` — substring filter on `label` or `description`
- `opts.filter` — `'all'` | `'owned'` | `'rented'` | `'forsale'`
- `opts.sort` — `'price'` | `'id'` | `'name'`

Server-side SQL uses `LIKE`, `EXISTS`, and `LIMIT/OFFSET`. The rental batch optimization applies here too.

---

## Broadcast thundering-herd on `propertiesChanged`

**Severity:** MEDIUM
**Status:** NOT FIXED (documented)

`TriggerClientEvent('sunset:client:propertiesChanged', -1)` is called 20+ times across the properties server (every buy/sell/rent/lock/etc.). Each fires on ALL connected players. Each recipient calls `refreshSoon()` → `refreshProperties()` → `AwaitCallback('sunset:getProperties')` → another N+1 sequence on the server.

With 20 players and 50 properties: **one /sellhouse triggers 20 players × 51 SQL queries = 1020 DB queries** in rapid succession.

### Recommended fix (not yet implemented)

1. Replace broadcast with targeted invalidation: send `propertiesChanged` only to players who have the properties panel open.
2. Use a generation counter (server-side epoch incremented on each change). Clients poll at 1Hz; only re-fetch when their cached generation differs from server's.
3. Alternatively, push the updated single-property diff to all clients instead of requiring a full re-fetch.

---

## SELECT * Audit

| File | Line | Table | Impact |
|------|------|-------|--------|
| `sunset_properties/server/main.lua` | 28 | `property_rentals` | LOW — `activeRental` fetches all columns; only `id`, `property_id`, `active` are used |
| `sunset_vehicles/server/main.lua` | 218,1118,1133 | `vehicles` | MEDIUM — wide table; only subset used |
| `sunset_core/server/main.lua` | 219,222,243,395,417,502,564 | `players`, `characters` | LOW — these are per-player lookups; `characters` is a wide table |
| `sunset_factions/server/police.lua` | 1473,1484 | `characters` | LOW |
| `sunset_businesses/server/main.lua` | 144,149,361 | `player_businesses` | LOW |

**Recommendation:** Replace `SELECT *` with explicit column lists in `activeRental` and `vehicles` fetches to reduce data transfer and allow index coverage. Not blocking.

---

## Queries Inside Loops

| File | Severity | Description |
|------|----------|-------------|
| `sunset_properties/server/main.lua:62` (pre-fix) | HIGH | `activeRental` called per row in `publicRow` inside `getProperties` loop — **FIXED** |
| `sunset_properties/server/main.lua:240-249` | LOW | `clearHome` called per renter in `evictPropertyRenters`; each call may do DB work for online players. Typically 0–5 renters. Acceptable. |

---

## Index Recommendations

```sql
-- Speeds up fetchRentedIds and activeRental lookups
ALTER TABLE property_rentals ADD INDEX idx_char_active (character_id, active);

-- Speeds up getProperties renter_count subquery
ALTER TABLE property_rentals ADD INDEX idx_prop_active (property_id, active);

-- If getPropertiesPage search is used heavily
ALTER TABLE properties ADD FULLTEXT INDEX ft_label_desc (label, description);
```
