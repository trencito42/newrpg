# Canonical RPG progression

This document describes the code shipped on 2026-10-03. `sunset_core` owns XP, RP and character level. `sunset_jobs` owns profession progression. `sunset_quests` owns narrative chains and access gates. Racket Pass is the seasonal layer.

## Player path

1. Account authentication selects an account-owned character. A FiveM license identifies a connection and is not account ownership.
2. The starter chain teaches identity, inventory, help, legal work and a first payday.
3. The life chain completes when the character reaches level 10.
4. Faction invitations, in-game acceptance and panel applications require level 10 plus completed `life_reach_level10`. Panel administrators level 3+ have the documented operational bypass.
5. Advanced lockpicking requires job progression `lockpicking.advanced_shifts >= 20` through the quest access service.
6. Legal jobs, contact missions, business ownership, crime and faction play feed quests and/or Racket Pass missions.

## Canonical unlocks currently enforced

| Capability | Enforced gate |
|---|---|
| Faction application or invitation | level 10 + `life_reach_level10` |
| Advanced lockpicking | 20 advanced lockpicking shifts |
| Recipe access | station, faction/rank, recipe and inventory checks in `sunset_crafting` |
| Clan creation | 500 Racket Credits and clan validation |
| Mission rewards | server-owned session state and server-observed objectives |

Other level bands previously proposed in historical documents are product ideas, not current guarantees. New gates belong in `sunset_quests.AccessGates`; consumers call `CanAccess` instead of duplicating rules.

## Connected loops

- Garbage work produces plastic, cloth and metal scrap used by crafting.
- Valid carjack sales can produce gunpowder used by recipes.
- Chemicals remain purchasable at the 24/7 catalog.
- EMS crafting produces the usable `medkit`; the item heals 75 through the canonical item use path.
- Contact missions advance the weekly `contract_missions` pass mission.
- A first business purchase advances quest event `business_purchased` and pass mission `business_owner`.

`sunset_needs` is disabled for launch because needs had no persistent HUD feedback. Food and drinks remain usable consumables. Re-enable the resource only with a visible, tested player feedback loop.

## Known product gaps

Clan lifetime, renewal, grace periods and slot upgrades do not exist in the current schema or service. Do not sell or advertise them. Business ownership has no configured per-character cap (`0` means unlimited); revenue comes from actual player sales, but ownership pacing requires live economy data before tuning.
