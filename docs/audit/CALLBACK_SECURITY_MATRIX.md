# Callback security matrix

This is the mutation surface checked in this pass, not a dump of every `RegisterCallback`. Client-trusted money, item, and ownership amounts were rejected where the handler recomputes them on the server.

| Action | Auth | Character | Gate | Notes |
| --- | --- | --- | --- | --- |
| `sunset:server:prepareSpawn` | session must be authenticated | loaded character must match the permit | single-use permit, 15s | Bucket 9999 → 0. |
| `sunset:sessions:resetRoutingBucket` | character required after this fix | yes | refuses bucket 9999 | Was the auth escape. |
| `sunset:phoneMarketBuy` | callback player | yes | weapon license, `dealership.purchase`, `property.buy`, house `minimum_level` | Price is the listing row. One SQL transaction. |
| `sunset:phoneMarketCancel` | seller | yes | listing owned and active | Item return is inside the transaction and then reloads inventory. |
| `sunset:phoneMarketListItem` | owner | yes | tradable item, server price bounds | Remove then insert. Crash window FG-015. |
| `sunset:shop:purchase` | account from source | yes | catalog price only | `requestId` idempotency. Crash window FG-016. |
| `sunset:factionInvite` / accept | faction permission | yes | `sunset_quests:CanAccess('faction.apply')` | Level 10 and `life_reach_level10`. |
| Panel `faction_set_member` | leader or admin | target character | same gate unless admin level ≥ 3 | Queued to the bridge. The bridge is the check. |
| `sunset:clanAcceptInvite` | invited character | yes | `clan.join` level 10 | Capacity under `SELECT … FOR UPDATE`. |
| `sunset:buyProperty` | owner path | yes | `property.buy` and `minimum_level` | Unchanged direct path. Market now matches it. |
| `/attackturf`, `/intervene` | in-world player | clan member | `turf.participate` and `status == 'active'` | |
| `Sunset.RenameCharacter` | shop entitlement or admin | yes |  nickname rules in shop tests | One writer for shop and `/fnc`. |

No live `RegisterNetEvent` in this pass was found that adds cash from a client-supplied amount. Panel `set_cash` / `set_bank` are staff actions and write balances directly; they are an admin tool, not a player callback.
