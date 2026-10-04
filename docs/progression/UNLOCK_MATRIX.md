# Unlock matrix

| Level | Jobs | Property | Vehicles | Factions | Hunting | Criminal | Clans |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Fisherman. Courier, garbage, trucker after a driver license. | | Rent a ride $500. Buy from the dealership with a license. | | | | |
| 3 | Mechanic | Rent | | | | | |
| 4 | Bus | | | | | | |
| 6 | Diver | | | | | | |
| 8 | | Buy | | | | | |
| 10 | | | | Apply, after the level-10 story step | Range, weapon license, hunting license, then the job | Lockpicking after the car is stored. Carjack after lockpick practice. | Join |
| 12 | | | | | | Robbery after a chop | |
| 15 | | | | | | | Create for 500 RC. Turfs with an active clan. |

Buying a level is `/buylevel`, the M menu, or the phone settings panel. The next level costs the current level times 4 respect and times $1,000 (`LevelRespectMultiplier` and `LevelPriceBase` in `sunset_core/shared/config.lua`). Faction invite and accept call `sunset_quests:CanAccess` / `CanAccessCharacter`, which delegate to `sunset_core:CanAccess`. Staff admin level 3 or higher is the only intentional panel bypass.
