# New account progression audit

Source of truth is the current server code. Character level stays at the schema default of **1**. This audit does not introduce level 0.

## Stage 0 — account and character

**What the player sees.** Connect puts them through auth, then the character screen. A new account has no character. The create form asks for one nickname, date of birth, nationality, and gender.

**Rows created.**

| Record | Default from code |
|---|---|
| `accounts` | Created by the auth register path. `accounts.username` is the login. It is not the gameplay name. |
| `players` | One row per license. `playtime` 0. |
| `characters` | `level` 1, `xp` 0, `respect_points` 0, `job` unemployed, `cash` 250, `bank` 1000. Nickname is `firstname`. `lastname` is stored as `''`. |
| Inventory | 2 water, 2 bread, 1 id card, 1 phone. |
| Phone number | Derived `555-` plus the character id when the phone is first opened, if none was stored. |
| Spawn | LSIA, `-1037.58, -2737.58, 20.17`. |
| Licenses, vehicles, properties, clan, faction, quests | None until the player earns them. |

**Fixes.** The create form no longer asks for a first and last name. The server discards a client last name.

## Level 1 — first hour

**What they see.** They spawn at LSIA with a phone, food, water, and an ID. `/help` opens the help catalog and completes `onb_orientation`. `/quests` is the story tracker. Nothing on the map explains Racket as an RPG by itself; the help quest is the introduction.

**Story order.**

1. Open help.
2. Buy any shop item.
3. Use an ATM.
4. Get hired as a **Fisherman**. Courier, Trucker, and Garbage require a driver license and do not complete this step.
5. Pass the driving exam ($30, 10% of starting cash, clamped to $30–$100).
6. Rent a starter car at the dealership for $500. The quest event fires only after the vehicle exists.
7. Finish one shift, then three more.
8. Buy a car. Cheapest catalog car in `sql/26` and `sql/12` is the Blista at $16,500.
9. Store it.
10. Change clothes, rent a home (level 3), reach character level 10.

**Money check.** Starting $1,250 plus story rewards through Dedication ($14,350, including the $12,000 dedication payout) minus the $30 exam and $500 rental, plus four courier runs at $90 × 6 packages ($2,160), is $17,230. That covers the Blista. Dedication used to pay $1,000 while the objective text said five shifts and the counter was three, which could not buy the car.

**Level model.** `Sunset.AddXP` increases the `xp` column and does not change `characters.level`. A level is bought with `/buylevel`: RP cost is `level * 4`, money cost is `level * 3000`. Payday grants 1 RP after 20 minutes in that hour. Reaching level 10 from quests alone is not possible. The sum of RP from level 1 through 9 is 180. Main-story RP before that quest is about 28. The rest is payday. That is a long mid-game. The multiplier was not changed.

**Fix.** `life_reach_level10` used to add the new level into a counter of 10, so it completed around level 5. Progress is now the character's level, and it completes at 10. Buying level 10 sends one notification listing factions, hunting, criminal contacts, and clan membership.

## Level 3–9

| Level | Unlock in `progression_gates.lua` |
|---|---|
| 3 | Mechanic (also driver license), property rent |
| 4 | Bus driver (driver license) |
| 6 | Diver |
| 8 | Property purchase |

Job center and property callbacks call `CanAccess`. A locked job returns the gate reason (level, license, or quest). There is no separate tutorial quest for bus, diver, or mechanic. The player discovers them at the job center.

## Level 10

Unlocked together, each still with its own extra gate:

- Faction apply, after `life_reach_level10` is complete.
- Clan join.
- Lockpicking, after the car is stored (`car_garage_park`).
- Hunter, after firearm license, hunting license, and `hunt_range_challenge`.
- Hunting and criminal quest chains, after the building-a-life chain and level 10.

Carjack requires the lockpick practice quest. Robbery requires level 12 and a completed chop. Those callbacks are gated in `Sunset.ProgressionGates` and the job/crime resources that call `CanAccess`. This audit did not replay every criminal callback in a live session.

## Level 15

Clan creation costs 500 Racket Credits and requires level 15. Turf participation requires level 15 and an active, unexpired clan. Cash slot upgrades ($1,000,000 then $2,500,000) are a crew sink, not a solo afternoon.

## Systems that are not on the story rail

- **Always available:** phone, 24/7, ATM, help, quests, driving school, fisherman, casino and racing if the resources are started. Casino was not measured as an income source in this pass.
- **Faction only:** duty, faction fleet, department radio.
- **Clan only:** clan chat, turf attack, clan store upgrades.
- **Admin:** panel level edits, respect grants, give-car.
- **CNN:** civilians can read ads. Publishing is the news flow. News Reporter work is the faction, not the phone News app.

## Live checklist

No GTA session was played for this audit.

- [ ] Register. Expect an account and no character.
- [ ] Create a nickname only. Expect `lastname` empty and level 1, $250 / $1,000, starter items.
- [ ] Spawn at LSIA. Expect no black screen and a character already loaded.
- [ ] `/help` completes orientation.
- [ ] Buy one shop item. ATM once.
- [ ] Hire Fisherman. Hiring Courier before a license must fail and must not complete the quest.
- [ ] Pass the driving exam. Rent the $500 starter. Fail a rental with no cash and confirm the quest does not move.
- [ ] Finish four shifts. Claim Dedication. Buy the Blista from the bank or cash on hand.
- [ ] Store the car.
- [ ] Buy levels one at a time. At level 5 the level-10 quest is still active. At level 10 it completes and the milestone notice appears.
- [ ] Apply to a faction only after that quest is claimed.
- [ ] Disconnect after each claim and confirm the reward was not paid twice.

The LSIA spawn is about 1.9 km from the driving school (240, -1379) and about 1.9 km from the dealership (-56, -1096). Walking that before a license is a long first trip. Taxi has no character-level gate, so the player can ride there before the exam. The spawn was left where it is.

## Level timing after the respect change

A completed shift grants 2 respect and does not count as a payday. A job rank-up grants 4. Payday stays +1. Buying the next level costs `level * 4` respect and `level * $1,000`.

Reaching level 10 still costs 180 respect. Story rewards cover about 28. The other 152 are about 76 finished shifts. At roughly 10 minutes a shift that is about 13 hours of work, inside the 8–15 hour target. Level 3 is the early story plus a handful of shifts (about 1–2 hours). Level 5 is about 3–5 hours. Level 10 to 15 is about 240 more respect, about 20 hours of shifts.

The money to buy those levels from 1 to 10 is $45,000. Courier income over those shifts is on the order of $40,000 before the starter car, so the car and the levels fit in the same stretch instead of a 150-payday wall.

## Verdict

A new player can earn money as a fisherman before they have a license, then follow the story onto a licensed job. The main story no longer completes "reach level 10" early, and the first car is affordable if they claim the story rewards and work the early shifts. Level 10 systems are gated in one table and announced once. Level 15 clan creation is level-gated and credit-gated. The long part is character level itself: about 150 paydays after story RP, because level is purchased rather than granted by XP. Trading can still move items the gun store would refuse; that path was not closed in this pass.
